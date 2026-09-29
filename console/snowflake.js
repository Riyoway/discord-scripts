// Show the creation time encoded in a Discord ID or message link.
(() => {
  const input = prompt("Discord ID or message link:");
  if (input === null) return;

  const value = input.trim();
  const messageId = value.match(/^https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/(?:@me|\d+)\/\d+\/(\d{15,20})\/?(?:[?#].*)?$/)?.[1];
  const id = messageId || (/^\d{15,20}$/.test(value) ? value : null);
  if (!id) {
    alert("Enter a Discord ID or a Discord message link.");
    return;
  }

  // Discord snowflake: upper 42 bits are milliseconds since 2015-01-01 UTC.
  const milliseconds = Number((BigInt(id) >> 22n) + 1420070400000n);
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) {
    alert("Could not decode this ID.");
    return;
  }

  const timestamp = "<t:" + Math.floor(milliseconds / 1000) + ":F>";
  console.log({ id, createdAt: date.toISOString(), discordTimestamp: timestamp });
  prompt("Created: " + date.toLocaleString() + "\nCopy the Discord timestamp:", timestamp);
})();
