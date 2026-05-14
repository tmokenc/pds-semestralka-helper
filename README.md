# PDS — Vizualizace ke zkoušce

Interaktivní web aplikace pro přípravu na semestrální zkoušku z předmětu *Přenos dat, počítačové sítě a protokoly* (PDS), FIT VUT 2025/2026.

Devět tabů, jeden na každé téma z `temata26.pdf`. Každý tab obsahuje teoretický úvod, výklad podle bodů a interaktivní demonstrace klíčových algoritmů.

## Interaktivní demonstrace zahrnují

- **Topic 1 (Transport):** PER kalkulátor, prostor sek. čísel, EWMA timeout, animace 4 metod řízení toku (Stop-and-Wait/GBN/SR/FEC), GBN efektivita, TCP handshake, AIMD simulátor (Tahoe/Reno/CUBIC).
- **Topic 2 (Routing):** Výběr cesty (LPM + AD + metrika), step-by-step Dijkstra/Bellman-Ford na grafu, counting-to-infinity demo, OSPF cost kalkulátor, BGP 11-step route selection, MPLS LSP simulátor.
- **Topic 3 (Switches):** Switch architecture calculator, HoL+VOQ demo, **Take-a-Ticket/PIM/iSLIP** vizualizér se klikatelnou VOQ maticí, **Clos network builder** (m, n, r → strictly/rearrangeably), **Beneš BN_n builder**.
- **Topic 4 (Routers):** RIB→FIB kompilace, kontext paketu skrz 6 fází, slow/fast path klasifikátor, Process/Fast/CEF timing porovnání, CEF 256-way mtrie lookup.
- **Topic 5 (Classification):** ACL shadow detector, multibit trie builder s adjustable stride, HiCuts 2D rozhodovací strom, Lucent Bit Vector classifier s AND, TCAM lookup s priority encoder.
- **Topic 6 (P2P):** Milgram chart, animace nestrukturovaných algoritmů (záplava/kruh/walk/LMS) na P2P grafu, XOR vzdálenost kalkulátor, Kademlia k-buckety + FIND_VALUE traversal, BitTorrent swarm simulátor.
- **Topic 7 (IDS):** LCS step-by-step iteration, SPID byte frequency histogram, KL divergence kalkulátor, JA3 builder (truncated SHA-256 jako simulace MD5), DPA pravděpodobnostní automat.
- **Topic 8 (OS):** Paketový rozpočet kalkulátor (10 Mbps až 1 Tbps), netfilter 5-hook pipeline animace, sk_buff struktura, porovnání 5 architektur (Standard/NAPI/PF_RING/DPDK/XDP).
- **Topic 9 (SDN/P4):** DC topologie builder (tree/leaf-spine/fat-tree/folded Clos) s ECMP path tracer, oversubscription kalkulátor, OpenFlow flow entry tester.

## Spuštění lokálně

```sh
npm install
npm run dev        # dev server s hot reload (http://localhost:5173)
npm run build      # produkční build do dist/
npm run preview    # náhled produkčního buildu
```

## Nasazení na GitHub Pages

Repozitář obsahuje workflow `.github/workflows/deploy.yml`, který při každém pushi do větve `main`/`master`:

1. Spustí `npm ci && npm run build` s proměnnou `VITE_BASE=/<repo-name>/`.
2. Nahraje obsah `dist/` jako artefakt.
3. Publikuje na **GitHub Pages**.

### Aktivace v repozitáři

1. Push tento adresář jako kořen repozitáře.
2. V nastavení repa: **Settings → Pages → Source: GitHub Actions**.
3. Push do `main` spustí workflow; po dokončení bude aplikace dostupná na  
   `https://<uživatel>.github.io/<repo-name>/`.

Pokud webapp žije v podadresáři repozitáře (např. `webapp/`), v `deploy.yml` upravte `working-directory: ./webapp` a v `actions/upload-pages-artifact` `path: ./webapp/dist`.

## Struktura

```
webapp/
├── index.html              # Vstupní stránka
├── package.json            # Vite + závislosti
├── vite.config.js          # Vite konfigurace (čte VITE_BASE pro Pages)
├── .github/workflows/
│   └── deploy.yml          # Auto-deploy na GitHub Pages
└── src/
    ├── main.js             # Entry point — importuje styly + demo moduly
    ├── styles.css          # Všechny styly
    ├── tabs.js             # Tab switching + klávesnice + URL hash
    ├── overview.js         # Úvodní tab s 9 kartami
    ├── util.js             # Sdílené helpery (SVG, IP parsing)
    └── demos/              # Interaktivní demonstrace per téma
        ├── t1-transport.js
        ├── t2-routing.js
        ├── t3-switches.js
        ├── t4-routers.js
        ├── t5-classification.js
        ├── t6-p2p.js
        ├── t7-ids.js
        ├── t8-os.js
        └── t9-sdn.js
```

Po `npm run build` Vite vytvoří jeden bundleovaný a minifikovaný JS soubor v `dist/assets/app.js`.

## Klávesnice

- **←/→** v hlavním obsahu — přepíná taby
- **Hash v URL** (např. `#t3`) otevře konkrétní téma

## Známé limity

- **JA3 builder** používá truncovaný SHA-256 jako simulaci MD5 — prohlížeč nemá `crypto.subtle.digest('MD5')`. Pro reálné JA3 použijte serverovou implementaci.
- Aplikace je *pouze offline pomůcka*, neukládá průběh ani odpovědi.
