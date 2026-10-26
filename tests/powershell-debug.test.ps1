# Real loopback sockets and port ownership; no Discord restart or injection.
$ErrorActionPreference='Stop'
function Assert($condition,$message) { if (-not $condition) { throw $message } }
$root=Split-Path $PSScriptRoot -Parent
$ast=[Management.Automation.Language.Parser]::ParseFile("$root/powershell/run.ps1",[ref]$null,[ref]$null)
foreach ($name in 'Get-DiscordListeners','Get-DiscordLoopback','Get-DiscordDebugJson','Get-DiscordStartupTimeout','Test-Port') {
    . ([scriptblock]::Create($ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true).Extent.Text))
}
Add-Type @'
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
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
                        while (!String.IsNullOrEmpty(reader.ReadLine())) { }
                        string response = request.Contains("/json/version ")
                            ? "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 45\r\nConnection: close\r\n\r\n{\"Browser\":\"Chrome\",\"Protocol-Version\":\"1.3\"}"
                            : "HTTP/1.1 302 Found\r\nLocation: http://example.invalid/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                        byte[] bytes = Encoding.UTF8.GetBytes(response);
                        stream.Write(bytes,0,bytes.Length);
                    }
                } catch (IOException) { } catch (ObjectDisposedException) { }
            }
        }
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
            $selected=[pscustomobject]@{Name='Offline socket test';ProcessId=$PID}
            Assert (Test-Port) "Discover and connect to the real $address listener owned by this process"
            $expected=if ($address -eq '::1') { '[::1]' } else { '127.0.0.1' }
            Assert ($selected.DebugHost -eq $expected) 'Use the listener address family'
            Assert ($proxy.Hits -eq 0) 'Local debug requests must never consult the system proxy'
            $failed=$false
            try { $null=Get-DiscordDebugJson $expected $port '/json' 1000 } catch { $failed=$true }
            Assert $failed 'Never follow a local debug endpoint redirect to an external host'
            $selected.ProcessId=0
            Assert (-not (Test-Port)) 'Do not query an unowned port, even if it serves valid CDP JSON'
        } finally { $server.Dispose() }
    }
    Write-Host 'PASS: real IPv4/IPv6 listeners, PID ownership, proxy bypass, and redirect rejection.'
} finally { [Net.WebRequest]::DefaultWebProxy=$originalProxy }
