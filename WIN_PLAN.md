# Plan de victoire — KeeperHub Agents Onchain (DoraHacks)

Révisé le **mercredi 5 août 2026** à partir du **règlement officiel lu intégralement**
(plus aucune supposition). Deadline : **jeudi 13 août, 12:00 UTC+2**.

---

## 0. Les règles réelles

| | |
|---|---|
| Prize pool | **$5 000** — 1er $2 000 · 2e $1 200 · 3e $800 · bounties $1 000 |
| Deadline soumission | **13 août 12:00 UTC+2** |
| Présélection | L'équipe KeeperHub note toutes les soumissions → **10 finalistes** |
| **Pitchs live** | **17–19 août, 5 minutes max** devant le panel — le top 3 en sort |
| Résultats | 20 août |
| Concurrents inscrits | **400 hackers** |
| Juge invité | **Jose Galarza, VP Engineering @ Wise** |

**Exigence unique :** *« Every project must use KeeperHub as its onchain execution layer. »*
N'importe quel framework d'agent est accepté. Le réseau n'est **pas** imposé — « onchain »
suffit, Sepolia est recevable. Le gas sponsorisé existe sur mainnet, sans obligation.

**Soumission — 3 éléments obligatoires :**
1. Lien du code source GitHub
2. Vidéo courte montrant **l'agent exécutant on-chain via KeeperHub**
3. **Lien d'une transaction exécutée par l'agent via KeeperHub**

*« Incomplete submissions cannot be judged. »*

### Critères de notation, dans l'ordre du règlement

1. **Exécution on-chain via KeeperHub — pondéré fortement.** « Working transactions, not
   mockups. Every team links a transaction their agent has executed. »
2. **Usage des surfaces KeeperHub** : MCP server, CLI, x402, MPP, workflow builder,
   **audit trail**.
3. **Fiabilité et observabilité** : compréhension des modes de défaillance, retries,
   gestion du gas, usage de l'audit trail.
4. **Originalité et utilité réelle** : « Would anyone actually run this? »
5. **Qualité d'intégration et DX.**

## 1. Notre positionnement

Le thème du hackathon est *The Last Mile* : les agents savent décider, ils échouent à
exécuter. KeeperHub comble ce trou. **Notre angle est le maillon d'après :** une fois que
l'agent a exécuté, comment sait-on que ce qui est rapporté correspond à ce qui s'est
vraiment passé ?

C'est exactement le critère 3 — fiabilité et observabilité — et ça parlera à un VP
Engineering de Wise, dont le métier est précisément la réconciliation de paiements.

Argument massue, réel et vérifiable : **nous avons trouvé un faux négatif dans le
simulateur KeeperHub.** Il a prédit un échec, l'exécution a réussi. Nous ne le dénonçons
pas — nous en faisons la démonstration du besoin.

## 2. Trois cibles, pas une

| Cible | Ce qu'il faut | État |
|---|---|---|
| **A · Grand Prize** ($2 000) | Un agent qui exécute + les 3 éléments de soumission | ❌ **l'agent manque** |
| **B · Bounty Onboarding UX** ($500) | *« a clear teardown of where you got stuck with proposed fixes »* | ✅ **déjà écrit**, à mettre en forme |
| **C · Pitch live** (décide le top 3) | 5 minutes, oral, 17–19 août | ❌ à préparer |

**La cible B est du gain quasi gratuit et cumulable.** Le teardown du faux négatif de
simulation existe déjà dans nos documents ; il faut le transformer en contribution propre
(issue GitHub argumentée sur le repo open-source KeeperHub + éventuellement une PR de
correctif ou de documentation). Coût : une demi-journée. C'est une seconde chance de gain
indépendante du Grand Prize.

## 3. État au 5 août

### ✅ Gelé et livré — ProofGate

| | |
|---|---|
| Repo public | https://github.com/Damso74/proofgate |
| Live | https://proofgate.vercel.app |
| Qualité | 16 tests unitaires + 12 E2E (4 largeurs), lint et typecheck verts |

**Ne plus y toucher** sans re-vérifier les 4 digests de parité avec le moteur ArcadeOps.

### ✅ Acquis

- **Transaction réelle via KeeperHub** : [`0x0801289e…`](https://sepolia.etherscan.io/tx/0x0801289edfdcfd919b64b1f7e267d935674d09fa09de7a9670b8aa169bcb605e)
- **MCP KeeperHub** intégré : OAuth, `execute_transfer`, idempotence, statuts → couvre le
  critère 2 (surfaces)
- **Faux négatif du simulateur** documenté et reproductible → alimente les critères 3 et 4
  **et** la cible B

### ❌ Manquant

- **L'agent autonome.** Notre transaction a été déclenchée à la main. C'est le seul vrai
  blocage, et il porte le critère le plus lourd.
- Usage de l'**audit trail** KeeperHub (critère 2 et 3) — non exploité à ce jour
- La vidéo, le pitch live, le BUIDL

## 4. L'agent — Treasury Drip Agent

Emplacement : `apps/keeper-agent/` dans **ArcadeOps** (ProofGate reste gelé).

Boucle autonome, aucun humain dans la décision :

1. **Observer** — état on-chain lu en direct (RPC) : allocation restante via sonde
   `eth_call` sur l'enveloppe Roles, solde USDC du Safe, historique `ConsumeAllowance`.
2. **Décider** — règle déterministe : si `restant ≥ montant + marge` et aucun versement
   dans la fenêtre → verser ; sinon s'abstenir **et journaliser pourquoi**.
3. **Exécuter** — `execute_transfer` via MCP KeeperHub, clé d'idempotence dérivée de la
   fenêtre.
4. **Réconcilier** — `get_direct_execution_status` **+ l'audit trail KeeperHub**, puis
   verdict par le moteur. **L'agent ne déclare jamais « completed » sur la foi du
   fournisseur** : son rapport est `VERIFIED_*` ou rien.

Ce que ça coche : critère 1 (exécution), critère 2 (MCP + audit trail), critère 3 (modes de
défaillance explicites, idempotence, faux négatif géré), critère 4 (un agent de trésorerie
auditable, ça se déploie vraiment).

Garde-fous :

- **Montants 0,1 USDC.** Il ne reste que 4 USDC d'allocation ; les reprises vidéo puisent
  dedans. Vérifier le reset hebdomadaire.
- `simulate: true` d'abord, traité comme **signal non bloquant** — le faux négatif est
  documenté, et c'est un argument de démo.
- **Jamais de retry automatique** d'`execute_transfer`. Idempotence systématique.
- Pas de LLM dans la décision : une règle déterministe est **auditable**, donc un argument.

## 5. Calendrier

| Jour | Objectif | Sortie vérifiable |
|---|---|---|
| **mer 5** | Compte DoraHacks + brouillon BUIDL. Rejoindre le Discord. Préparer les questions pour demain. | Brouillon créé, Discord rejoint. |
| **jeu 6** | **Office hours 12:00 CEST** (dernière session) — https://meet.google.com/owv-jdwm-sys. Puis squelette agent : client MCP, lecture d'état, décision, **dry-run sans broadcast**. | Questions posées ; log de décision correct. |
| **ven 7** | **Première transaction exécutée par l'agent.** Réconciliation incluant l'audit trail. | Tx hash agent-driven + verdict `VERIFIED_*`. |
| **sam 8** | **Cible B** : teardown du faux négatif en issue/PR sur le repo KeeperHub. Consolidation agent. | Contribution soumise, lien conservé. |
| **dim 9** | **GATE GO/NO-GO** : tx agent-driven rejouable à la demande. | Démo bout-en-bout, deux fois de suite. |
| **lun 10** | Rushes vidéo (agent décide → tx → Etherscan → verdict). | **Une prise brute non coupée** de l'exécution. |
| **mar 11** | Montage 2:30. Page BUIDL en anglais. Captures. | Vidéo v1 + BUIDL complet. |
| **mer 12** | Relecture à froid. **SOUMISSION.** | Soumission confirmée. |
| **jeu 13** | Urgences uniquement. Deadline 12:00. | — |
| **17–19 août** | **Pitch live 5 min** si finaliste. Se rendre disponible. | Pitch répété, chronométré. |

**Gate du dimanche 9** : si l'agent n'a pas exécuté, on coupe tout le reste et on consacre
lun→mer à le faire exécuter puis filmer.

## 6. Pitch live — 5 minutes (à préparer dès finaliste)

Structure, sans slides inutiles :

1. **0:00–0:45** — Le problème, avec notre incident réel : le simulateur a dit non,
   l'exécution a dit oui.
2. **0:45–2:30** — **L'agent exécute en direct ou en enregistrement.** Décision → KeeperHub
   → transaction. C'est le cœur.
3. **2:30–4:00** — La réconciliation : chemin Roles → Safe, allocation consommée, verdict,
   digest vérifiable. Insister sur les **modes de défaillance** (critère 3) — c'est là que
   le juge de Wise décroche ou accroche.
4. **4:00–5:00** — Le blocage contrefactuel + la contribution au repo KeeperHub. Fin sur :
   *KeeperHub executes autonomous actions. ProofGate independently reconciles agent claims,
   policy state, and captured on-chain evidence before the result is trusted.*

Répéter chronométré. 5 minutes maximum, c'est court.

## 7. Checklist de soumission

- [ ] Compte DoraHacks + BUIDL créé
- [ ] **Lien GitHub du code source** (obligatoire)
- [ ] **Vidéo** montrant l'agent exécuter via KeeperHub (obligatoire)
- [ ] **Lien de transaction exécutée par l'agent** (obligatoire)
- [ ] ProofGate — ✅ https://github.com/Damso74/proofgate · https://proofgate.vercel.app
- [ ] Description EN : problème → agent → exécution → réconciliation → **limites franches**
- [ ] Mention des surfaces KeeperHub utilisées (MCP, audit trail) — critère 2
- [ ] Section fiabilité : modes de défaillance, idempotence, faux négatif — critère 3
- [ ] Contribution bounty soumise séparément
- [ ] Soumis **le 12 au soir**

## 8. Risques

| Risque | Parade |
|---|---|
| L'agent n'exécute pas à temps | Gate du 9 ; tout le reste est sacrifiable |
| Allocation épuisée par les reprises | 0,1 USDC par tir ; compter ; vérifier le reset hebdo |
| KeeperHub indisponible en fin de course | Transactions définitives **au plus tard le 9** |
| Indisponible pour le pitch live 17–19 | Bloquer les créneaux dès maintenant |
| 400 inscrits | Beaucoup ne soumettront pas ; le filtre « exécution réelle » élimine la majorité |
| Casser ProofGate gelé | Ne rien y modifier |

## 9. Ce qu'on ne fait pas

Pas de multi-chain, pas de framework d'agent lourd, pas de refonte ProofGate, pas de LLM
décisionnel, pas de mainnet sauf raison impérieuse (rien ne l'impose).

## 10. Évaluation

400 inscrits, mais le premier filtre est *« working transactions, not mockups »* — que la
majorité des projets d'agents ne franchit pas. Nous avons le chemin d'exécution déjà prouvé,
un angle aligné sur les critères 3 et 4, et une contribution bounty quasi gratuite.

**Si l'agent exécute avant le 13, la présélection parmi les 10 finalistes est un objectif
réaliste, et le top 3 se jouera au pitch live. Sans agent, la soumission est incomplète et
ne peut pas être jugée.**

---

## Liens utiles

- Hackathon : https://dorahacks.io/hackathon/agents-onchain/detail
- Soumettre : https://dorahacks.io/hackathon/agents-onchain/buidl
- Office hours (jeu 6, 12:00 CEST) : https://meet.google.com/owv-jdwm-sys
- Discord KeeperHub : https://discord.gg/keeperhub
- Docs MCP : https://docs.keeperhub.com/ai-tools/mcp-server
- Agentic wallet (x402/MPP) : https://docs.keeperhub.com/ai-tools/agentic-wallet
- Tout en un : https://keeperhub.com/links
