// whoami — print your own account and a quick inventory to the console. Read-only.
(() => {
    const req = webpackChunkdiscord_app.push([[Symbol()], {}, (r) => r]);
    webpackChunkdiscord_app.pop();
    const mods = Object.values(req.c);

    // Stores are exported under different keys per build; probe the common wrappers.
    const find = (method) => {
        for (const mod of mods) {
            const ex = mod?.exports;
            if (!ex) continue;
            for (const v of [ex, ex.default, ex.Z, ex.A, ex.ZP, ex.Ay, ex.H, ex.h]) {
                try { if (v && typeof v[method] === "function") return v; } catch { }
            }
        }
        return null;
    };

    const me = find("getCurrentUser")?.getCurrentUser?.();
    if (!me) { console.error("%c[whoami]", "color:#ed4245;font-weight:bold", "Could not read the current user (Discord internals changed)."); return; }

    const guilds = Object.values(find("getGuilds")?.getGuilds?.() ?? {});
    const dms = find("getSortedPrivateChannels")?.getSortedPrivateChannels?.() ?? [];
    const friends = find("getFriendIDs")?.getFriendIDs?.() ?? [];
    const created = new Date(Number((BigInt(me.id) >> 22n)) + 1420070400000);
    const nitro = ["None", "Nitro Classic", "Nitro", "Nitro Basic"][me.premiumType ?? 0] ?? "Unknown";

    console.log("%c[whoami]", "color:#5865f2;font-weight:bold;font-size:1.1em",
        `${me.username}${me.discriminator && me.discriminator !== "0" ? "#" + me.discriminator : ""}`);
    console.table({
        id: me.id,
        username: me.username,
        displayName: me.globalName ?? "",
        email: me.email ?? "",
        phone: me.phone ?? "",
        mfaEnabled: !!me.mfaEnabled,
        nitro,
        createdAt: created.toISOString(),
        servers: guilds.length,
        dms: dms.length,
        friends: friends.length,
    });
    console.table(
        guilds
            .map((g) => ({ name: g.name, id: g.id, owner: g.ownerId === me.id }))
            .sort((a, b) => a.name.localeCompare(b.name))
    );
})();
