# Plan de victoire — Agents Onchain (KeeperHub × DoraHacks)

Mis à jour le **mercredi 5 août 2026**. Deadline : **jeudi 13 août, 12:00 UTC+2**.
Il reste **7 jours pleins + la matinée du 13**. Objectif de soumission : **mercredi 12 au soir.**

---

## 0. La seule chose qui décide du classement

> *« Ship a working agent that executes through KeeperHub. »*

La soumission exige **une vidéo de l'agent exécutant on-chain via KeeperHub** et **le lien
d'une transaction exécutée par cet agent**. Le Grand Prize est jugé d'abord là-dessus. Les
organisateurs le disent noir sur blanc : un projet qui exécute réellement passe devant une
démo léchée qui ne touche jamais la chaîne.

**ProofGate ne coche pas cette case.** ProofGate *vérifie* ; le hackathon récompense ce qui
*exécute*. C'est un multiplicateur exceptionnel, pas le ticket d'entrée.

**Chemin critique : agent autonome → transaction exécutée par lui → vidéo → soumission.**
Toute journée qui n'avance pas là-dessus est perdue.

## 1. État au 5 août

### ✅ Terminé et gelé — ProofGate

| | |
|---|---|
| Repo public | https://github.com/Damso74/proofgate |
| Live | https://proofgate.vercel.app |
| Tests | 16 unitaires + 12 E2E (4 largeurs), lint et typecheck verts |
| Build | statique, 245 kB, zéro backend, zéro RPC live |

**Ne plus y toucher.** Toute modification demande de re-vérifier les 4 digests de parité
avec le moteur ArcadeOps. Le gel est un choix, pas un oubli.

### ✅ Acquis exploitables

- **Transaction réelle via KeeperHub** : [`0x0801289e…`](https://sepolia.etherscan.io/tx/0x0801289edfdcfd919b64b1f7e267d935674d09fa09de7a9670b8aa169bcb605e)
  — prouve que le chemin `KeeperHub → Roles Modifier → Safe → USDC` fonctionne de bout en bout.
- **Intégration MCP KeeperHub complète** : OAuth, `execute_transfer`, idempotence, statuts.
- **Un défaut réel du simulateur KeeperHub**, documenté et reproductible (faux négatif).
- **Compréhension du chemin Roles/Safe** que la plupart des participants n'auront pas.

### ❌ La pièce manquante — l'agent

Aucun agent autonome n'existe. Notre transaction a été déclenchée manuellement, pas par un
agent. **C'est le seul vrai blocage.**

### ❓ À lever d'urgence

- **Règlement complet non lu.** Mes informations viennent de recherches web ; la page
  DoraHacks bloque le fetch automatique. À récupérer à la main **aujourd'hui**.
- **Sepolia ou mainnet ?** Le gas sponsorisé est annoncé sur **Ethereum mainnet**. À
  confirmer aux office hours avant d'engager quoi que ce soit.

## 2. L'agent — Treasury Drip Agent

Emplacement : `apps/keeper-agent/` **dans le dépôt ArcadeOps** (pas ici — ProofGate est gelé).

Boucle autonome, sans humain dans la décision :

1. **Observer** — lire l'état on-chain en direct (RPC, pas KeeperHub) : allocation restante
   via sonde `eth_call` sur l'enveloppe Roles, solde USDC du Safe, historique `ConsumeAllowance`.
2. **Décider** — règle déterministe : si `restant ≥ montant + marge` et aucun versement dans
   la fenêtre courante → verser ; sinon s'abstenir **et journaliser pourquoi**.
3. **Exécuter** — `execute_transfer` via MCP KeeperHub, clé d'idempotence dérivée de la
   fenêtre (`drip-<semaine>-<n>`).
4. **Vérifier** — `get_direct_execution_status`, capture des preuves, puis verdict par le
   moteur. **L'agent ne déclare jamais « completed » sur la foi du fournisseur** : son
   rapport est `VERIFIED_*` ou rien. C'est exactement le récit ProofGate, rendu vivant.

Garde-fous non négociables :

- **Montants micro : 0,1 USDC.** Il ne reste que **4 USDC** d'allocation ; les reprises
  vidéo puisent dedans. Vérifier quand la fenêtre hebdo se réinitialise.
- `simulate: true` d'abord, traité comme **signal non bloquant** (faux négatif documenté) —
  c'est même un argument de démo.
- Jamais de retry automatique d'`execute_transfer`. Clé d'idempotence systématique.
- Pas de LLM dans la boucle de décision : une règle déterministe est un **argument**, pas une
  limitation. C'est ce qui rend l'agent auditable.

## 3. Calendrier

| Jour | Objectif | Sortie vérifiable |
|---|---|---|
| **mer 5 (aujourd'hui)** | Compte DoraHacks + brouillon BUIDL. **Récupérer le règlement complet.** Poster aux office hours : ① Sepolia accepté ou mainnet requis ② procédure gas sponsorship ③ signalement du faux négatif de simulation. | Règlement archivé, questions postées. |
| **jeu 6** | Squelette agent : client MCP direct + OAuth, lecture d'état, règle de décision, **dry-run complet sans broadcast**. | Log de décision correct sur l'état réel. |
| **ven 7** | **Première transaction exécutée par l'agent.** Capture des preuves, verdict moteur. | Tx hash agent-driven + verdict `VERIFIED_*`. |
| **sam 8** | Selon réponse office hours : réplique mainnet, **ou** consolidation Sepolia (reprises, logs propres, README agent). | Décision réseau actée. |
| **dim 9** | **GATE GO/NO-GO** : une tx agent-driven vérifiée existe et se rejoue à la demande. | Démo bout-en-bout rejouable deux fois de suite. |
| **lun 10** | Vidéo : rushes (agent décide → tx → Etherscan → verdict ProofGate). | Rushes + **une prise brute non coupée** de la séquence d'exécution. |
| **mar 11** | Montage 2:30. Page BUIDL rédigée en anglais. Captures finales. | Vidéo v1 + page complète. |
| **mer 12** | Relecture à froid, corrections, **SOUMISSION**. | Soumission confirmée. |
| **jeu 13** | Urgences uniquement. Deadline 12:00 UTC+2. | — |

**Règle du gate (dimanche 9)** : si l'agent n'a pas exécuté, on **coupe tout le reste** —
mainnet, polish, intégration ProofGate du run agent — et on consacre lun→mer à faire
exécuter l'agent puis filmer. Une soumission incomplète n'est pas jugée.

## 4. Vidéo — 2:30

| Temps | Contenu |
|---|---|
| 0:00–0:15 | Le problème : les plateformes d'agents rapportent des statuts depuis des signaux incomplets. Montrer le faux négatif réel du simulateur. |
| **0:15–1:15** | **L'agent exécute.** Décision journalisée → `execute_transfer` KeeperHub → tx sur Etherscan. *C'est la séquence exigée par le jury ; elle porte la soumission.* |
| 1:15–2:00 | ProofGate réconcilie : chemin Roles → Safe, `ConsumeAllowance`, verdict, digest vérifié dans le navigateur. |
| 2:00–2:30 | Le blocage contrefactuel (5 > 4 USDC) puis le message final. |

Message final, mot pour mot :

> **KeeperHub executes autonomous actions. ProofGate independently reconciles agent claims,
> policy state, and captured on-chain evidence before the result is trusted.**

Garder **une prise brute non coupée** de la séquence d'exécution : c'est la preuve si le
montage soulève un doute.

## 5. Checklist de soumission

- [ ] Règlement complet lu et archivé
- [ ] Vidéo montrant **l'agent** exécuter via KeeperHub
- [ ] Lien(s) de transaction exécutée(s) **par l'agent**
- [ ] Repo ProofGate public — ✅ https://github.com/Damso74/proofgate
- [ ] Repo agent accessible au jury
- [ ] URL live — ✅ https://proofgate.vercel.app
- [ ] Description EN : problème → agent → exécution → vérification → **limites franches**
- [ ] Réseau annoncé explicitement (Sepolia ou mainnet)
- [ ] Soumis **le 12 au soir**

## 6. Risques

| Risque | Parade |
|---|---|
| Sepolia jugé insuffisant | Question posée aujourd'hui ; bascule mainnet le 8 au plus tard, sinon on assume Sepolia en l'affichant clairement |
| Allocation épuisée par les reprises | Montants 0,1 USDC ; compter les tirs ; vérifier le reset hebdo |
| KeeperHub indisponible près de la deadline | Exécuter les tx définitives **au plus tard le 9** ; ne rien garder pour la fin |
| Token OAuth expiré | Tester la reprise à froid dès le 6 |
| Casser ProofGate gelé | Ne rien y modifier. Si run agent ajouté : scénario additif, goldens séparés, E2E existants inchangés |

## 7. Ce qu'on ne fait pas

Pas de multi-chain, pas de framework d'agent lourd, pas de refonte ProofGate, pas de nouveau
produit, pas de LLM décisionnel, pas de course au bounty « Onboarding UX » — ce n'est pas
notre couloir, on joue le Grand Prize.

## 8. Évaluation honnête

Non quantifiable sans voir les concurrents. Structurellement : petit hackathon (bounties
1 000 $), premier filtre du jury = exécution réelle, que la majorité des projets d'agents ne
franchissent jamais. Nous avons le chemin d'exécution déjà prouvé, un différenciateur
défendable et un défaut du sponsor documenté.

**Si l'agent exécute avant le 13, le top 3 est un objectif sérieux. Sans agent, ProofGate
seul ne gagne rien** — il rate le critère central, aussi abouti soit-il.

---

## Sources

- [KeeperHub — Agents Onchain (DoraHacks)](https://dorahacks.io/hackathon/agents-onchain/detail)
- [KeeperHub](https://keeperhub.com/)

⚠️ Les règles résumées ici proviennent de **recherches web**, pas de la page officielle
(HTTP 405 au fetch). **À confirmer manuellement avant de s'y fier.**
