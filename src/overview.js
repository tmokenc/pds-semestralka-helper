// Overview tab: 9 topic cards with bullets from temata26.pdf

const TOPICS = [
  {
    n: 1, key: 't1', title: 'Transportní protokoly',
    bullets: [
      'Detekce chyb: sekvenční čísla, timeout, NACK',
      'Řízení toku: stop-and-wait, GBN, SR, FEC',
      'TCP, UDP, MP-TCP, QUIC, SCTP, DCCP',
    ],
  },
  {
    n: 2, key: 't2', title: 'Teorie směrování',
    bullets: [
      'Směrovací tabulka, AD, link-state/distance-vector/path-vector',
      'Bellman-Ford, Dijkstra',
      'RIP, EIGRP, OSPF, IS-IS',
      'BGP (eBGP/iBGP), MPLS',
    ],
  },
  {
    n: 3, key: 't3', title: 'Architektura přepínačů',
    bullets: [
      'Sdílená sběrnice, sdílená paměť, crossbar',
      'Párování: Take-a-Ticket, PIM, iSLIP',
      'Clos (m ≥ 2n−1), Beneš (rekurzivní)',
    ],
  },
  {
    n: 4, key: 't4', title: 'Architektura směrovačů',
    bullets: [
      'RIB vs FIB, kontext paketu, 6 fází',
      'Slow Path vs Fast Path',
      'Process Switching / Fast Switching / CEF',
    ],
  },
  {
    n: 5, key: 't5', title: 'Klasifikace paketů',
    bullets: [
      'ACL vs IP lookup',
      '1D: binární / multibit trie',
      '2D: hierarchical / backtracking / HiCuts',
      'nD: bit vector, kartézský součin, TCAM',
    ],
  },
  {
    n: 6, key: 't6', title: 'Sítě P2P',
    bullets: [
      'Problém malého světa (Milgram)',
      'Pure vs hybrid, referenční model',
      'Nestrukturované: záplava, kruh, walk, LMS',
      'Strukturované: Kademlia, BitTorrent',
    ],
  },
  {
    n: 7, key: 't7', title: 'Identifikace provozu',
    bullets: [
      'Hlavičky, signatury, LCS',
      'SPID + KL divergence',
      'TLS otisky JA3/JA4',
      'Detekce anomálií, DPA',
    ],
  },
  {
    n: 8, key: 't8', title: 'Zpracování paketu v OS',
    bullets: [
      'sk_buff, nf_hooks',
      'iptables tabulky',
      'PF_RING ZC, DPDK, XDP',
    ],
  },
  {
    n: 9, key: 't9', title: 'Datová centra, SDN, P4',
    bullets: [
      'Topologie tree/leaf-spine/Clos',
      'SDN, OpenFlow (Match-Action)',
      'NFV',
      'P4 — programovatelný data plane',
    ],
  },
];

export function initOverview() {
  const grid = document.getElementById('overview-grid');
  if (!grid) return;
  grid.innerHTML = TOPICS.map(t => `
    <div class="topic-card" data-target="${t.key}">
      <div class="topic-num">${t.n}</div>
      <h3>${t.title}</h3>
      <ul class="bullets">
        ${t.bullets.map(b => `<li>${b}</li>`).join('')}
      </ul>
    </div>
  `).join('');
  grid.querySelectorAll('.topic-card').forEach(card => {
    card.addEventListener('click', () => {
      if (window.PDS_activate) window.PDS_activate(card.dataset.target);
    });
  });
}
