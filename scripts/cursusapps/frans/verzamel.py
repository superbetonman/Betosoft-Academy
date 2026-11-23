import asyncio, json
from playwright.async_api import async_playwright
JS = r'''() => {
 const strip = h => h.replace(/<[^>]+>/g, "").replace(/­|&shy;/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
 const key = t => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
 const root = document.querySelector(".lesson"); if (!root) return [];
 return [...root.querySelectorAll("[data-say]")].map(el => { const t = el.dataset.sayText || strip(el.innerHTML); return t ? [key(t), t] : null; }).filter(Boolean);
}'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page()
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/fr/demo/BMC/"); await pg.wait_for_timeout(1500)
        ids = await pg.evaluate("() => [...document.querySelectorAll('#toc a[href^=\"#m\"]')].map(a => a.getAttribute('href').slice(1))")
        alle = {}; per = {}; orde = {}
        for i in ids:
            await pg.evaluate(f"location.hash = '{i}'"); await pg.wait_for_timeout(400)
            r = await pg.evaluate(JS); per[i] = len(r); orde[i] = r
            for k, t in r: alle[k] = t
        await pg.screenshot(path="shot-les.png")
        await pg.evaluate("location.hash = 'start'"); await pg.wait_for_timeout(500)
        await pg.screenshot(path="shot-start.png", full_page=False)
        print("lessen", per, "uniek", len(alle), "tekens", sum(len(t) for t in alle.values())); print("fouten", errs)
        json.dump(alle, open("voix-teksten.json", "w"), ensure_ascii=False, indent=0); json.dump(orde, open("voix-orde.json", "w"), ensure_ascii=False, indent=0)
        await b.close()
asyncio.run(main())
