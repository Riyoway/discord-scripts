# Real loopback sockets and port ownership; no Discord restart or injection.
$ErrorActionPreference='Stop'
function Assert($condition,$message) { if (-not $condition) { throw $message } }
$root=Split-Path $PSScriptRoot -Parent
$ast=[Management.Automation.Language.Parser]::ParseFile("$root/powershell/run.ps1",[ref]$null,[ref]$null)
foreach ($name in 'Get-DiscordListeners','Get-DiscordLoopback','Get-DiscordDebugJson','Get-DiscordStartupTimeout','Get-DiscordDebugPort','Get-DiscordSocketUrl','Invoke-DiscordProtocol','Get-DiscordDebugProcessId','Confirm-DiscordProcess','Test-Port') {
    . ([scriptblock]::Create($ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true).Extent.Text))
}
Add-Type @'
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Security.Cryptography;
public class RiyoDebugTestProxy : IWebProxy {
    public int Hits;
    public ICredentials Credentials { get; set; }
    public bool IsBypassed(Uri address) { Interlocked.Increment(ref Hits); return false; }
    public Uri GetProxy(Uri address) { Interlocked.Increment(ref Hits); return new Uri("http://127.0.0.1:1"); }
}
public class RiyoDebugTestServer : IDisposable {
    readonly TcpListener listener;
    readonly Thread thread;
    public readonly int Port;
    public int BrowserProcessId = System.Diagnostics.Process.GetCurrentProcess().Id;
    public RiyoDebugTestServer(string address) {
        listener = new TcpListener(IPAddress.Parse(address), 0);
        if (listener.Server.AddressFamily == AddressFamily.InterNetworkV6) listener.Server.DualMode = false;
        listener.Start();
        Port = ((IPEndPoint)listener.LocalEndpoint).Port;
        thread = new Thread(Serve); thread.IsBackground = true; thread.Start();
    }
    void Serve() {
        while (true) {
            TcpClient client;
            try { client = listener.AcceptTcpClient(); } catch (SocketException) { return; } catch (ObjectDisposedException) { return; }
            using (client) {
                client.ReceiveTimeout = 2000;
                try {
                    using (var stream = client.GetStream()) {
                        var reader = new StreamReader(stream);
                        string request = reader.ReadLine();
                        if (request == null) continue;
                        string key = null, line;
                        while (!String.IsNullOrEmpty(line = reader.ReadLine())) {
                            if (line.StartsWith("Sec-WebSocket-Key:", StringComparison.OrdinalIgnoreCase)) key=line.Substring(line.IndexOf(':')+1).Trim();
                        }
                        if (request.Contains("/devtools/browser/test ")) {
                            string accept;
                            using (var sha = SHA1.Create()) accept=Convert.ToBase64String(sha.ComputeHash(Encoding.ASCII.GetBytes(key+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11")));
                            Write(stream,"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "+accept+"\r\n\r\n");
                            stream.ReadByte(); int count=stream.ReadByte() & 127;
                            if (count == 126) count=(stream.ReadByte()<<8)|stream.ReadByte();
                            var mask=new byte[4]; Read(stream,mask);
                            var payload=new byte[count]; Read(stream,payload);
                            for(int i=0;i<count;i++) payload[i]=(byte)(payload[i]^mask[i%4]);
                            if (!Encoding.UTF8.GetString(payload).Contains("SystemInfo.getProcessInfo")) throw new IOException("Only read-only browser process identity is allowed in this fixture");
                            Frame(stream,"{\"method\":\"Test.event\"}",0x81);
                            string identity="{\"id\":1,\"result\":{\"processInfo\":[{\"type\":\"browser\",\"id\":"+BrowserProcessId+"}]}}";
                            int half=identity.Length/2;
                            Frame(stream,identity.Substring(0,half),0x01);
                            Frame(stream,identity.Substring(half),0x80);
                            continue;
                        }
                        string body="{\"Browser\":\"Chrome\",\"Protocol-Version\":\"1.3\",\"webSocketDebuggerUrl\":\"ws://localhost:"+Port+"/devtools/browser/test\"}";
                        string response = request.Contains("/json/version ")
                            ? "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "+body.Length+"\r\nConnection: close\r\n\r\n"+body
                            : "HTTP/1.1 302 Found\r\nLocation: http://example.invalid/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                        byte[] bytes = Encoding.UTF8.GetBytes(response);
                        stream.Write(bytes,0,bytes.Length);
                    }
                } catch (IOException) { } catch (ObjectDisposedException) { }
            }
        }
    }
    static void Write(Stream stream,string text) { byte[] b=Encoding.UTF8.GetBytes(text); stream.Write(b,0,b.Length); }
    static void Read(Stream stream,byte[] data) {
        int offset=0;
        while(offset<data.Length) {int n=stream.Read(data,offset,data.Length-offset);if(n==0)throw new IOException("Unexpected socket close");offset+=n;}
    }
    static void Frame(Stream stream,string text,byte opcode) {
        byte[] b=Encoding.UTF8.GetBytes(text); stream.WriteByte(opcode);
        if(b.Length<126) stream.WriteByte((byte)b.Length);
        else {stream.WriteByte(126);stream.WriteByte((byte)(b.Length>>8));stream.WriteByte((byte)b.Length);}
        stream.Write(b,0,b.Length); stream.Flush();
    }
    public void Dispose() { listener.Stop(); thread.Join(3000); }
}
'@
$macOS=$false
$startupWait=[Diagnostics.Stopwatch]::StartNew()
$proxy=New-Object RiyoDebugTestProxy
$originalProxy=[Net.WebRequest]::DefaultWebProxy
[Net.WebRequest]::DefaultWebProxy=$proxy
try {
    $addresses=@('127.0.0.1')
    if ([Net.Sockets.Socket]::OSSupportsIPv6) { $addresses += '::1' }
    foreach ($address in $addresses) {
        $server=New-Object RiyoDebugTestServer($address)
        try {
            $port=$server.Port
            $selected=[pscustomobject]@{Name='Offline socket test';ProcessId=$PID;DefaultPort=$port}
            Assert (Test-Port) "Discover and connect to the real $address listener owned by this process"
            $expected=if ($address -eq '::1') { '[::1]' } else { '127.0.0.1' }
            Assert ($selected.DebugHost -eq $expected) 'Use the listener address family'
            Assert ($proxy.Hits -eq 0) 'Local debug requests must never consult the system proxy'
            & {
                function Get-DiscordListeners { @() }
                Assert (Test-Port) 'Verify the real browser WebSocket PID when the Windows TCP table is empty'
                Assert ($selected.DebugHost -eq $expected) 'The identity fallback must support IPv4 and IPv6'
                $server.BrowserProcessId=$PID+1
                Assert (-not (Test-Port)) 'Reject another process even when its HTTP endpoint speaks CDP'
                Assert ($selected.DebugStatus -match 'reports PID') 'Keep identity failures useful instead of hiding them behind a timeout'
                $server.BrowserProcessId=0
                Assert (-not (Test-Port)) 'A missing browser identity cannot authorize injection'
                Assert ($selected.DebugStatus -match 'valid browser process ID') 'Preserve identity errors from the responding IPv4 or IPv6 endpoint'
                $server.BrowserProcessId=$PID
            }
            $failed=$false
            try { $null=Get-DiscordDebugJson $expected $port '/json' 1000 } catch { $failed=$true }
            Assert $failed 'Never follow a local debug endpoint redirect to an external host'
            $selected.ProcessId=0
            Assert (-not (Test-Port)) 'Do not accept an unselected process, even if it serves valid CDP JSON'
        } finally { $server.Dispose() }
    }
    Write-Host 'PASS: real IPv4/IPv6, browser WebSocket PID verification with hidden listeners, fragmented replies, foreign PID rejection, proxy bypass, and redirects.'
} finally { [Net.WebRequest]::DefaultWebProxy=$originalProxy }
