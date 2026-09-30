| Case | Musts (run 1 / 2 / 3) | Musts in all three, as judged | Musts in all three, matcher corrected | Must-nots (all three) | claude-haiku-4-5: musts in all three, corrected |
|---|---|---|---|---|---|
| `cascade-deq` | 14 / 13 / 13 of 15 | 12 of 15 | **13 of 15** ⚠ | 6 of 6 | 10 of 15 |
| `cascade-fire` | 2 / 2 / 2 of 3 | 2 of 3 | **2 of 3** | 4 of 4 | 3 of 3 |
| `cascade-osha` | 7 / 7 / 5 of 7 | 5 of 7 | **5 of 7** | 3 of 4 | 5 of 7 |
| `cascade-template-12` | 12 / 14 / 13 of 17 | 12 of 17 | **12 of 17** | 2 of 3 | 10 of 17 |
| `cascade-template-13` | 9 / 9 / 9 of 9 | 9 of 9 | **9 of 9** | 3 of 3 | 4 of 9 |

| Case | Findings (1/2/3) | Finding-title overlap | Findings with NO word (1/2/3) | Expected-not-seen (1/2/3) | Its overlap | Reshaped to dates | Handle errors | Forbidden words |
|---|---|---|---|---|---|---|---|---|
| `cascade-deq` | 22/25/21 | **3/56 = 0.05** | 3/4/1 | 7/5/6 | 1/12 = 0.08 | 0 | 0 | **none** |
| `cascade-fire` | 4/5/4 | **0/12 = 0.00** | 0/0/0 | 6/5/3 | 2/7 = 0.29 | 0 | 0 | **none** |
| `cascade-osha` | 35/34/35 | **7/79 = 0.09** | 5/5/5 | 11/10/11 | 7/16 = 0.44 | 0 | 0 | **none** |
| `cascade-template-12` | 16/16/16 | **16/16 = 1.00** | 0/0/0 | 0/0/0 | — | 0 | 0 | no-satisfied |
| `cascade-template-13` | 8/8/8 | **8/8 = 1.00** | 0/0/0 | 0/0/0 | — | 0 | 0 | **none** |

| Case | Cost per audit (1/2/3) | Mean | Wall (mean) | claude-haiku-4-5 cost (1/2/3) | Its mean | Its wall |
|---|---|---|---|---|---|---|
| `cascade-deq` | $0.4508 / $0.4445 / $0.2158 | **$0.3704** | 129.5s | $0.0351 / $0.0277 / $0.0278 | $0.0302 | 37.0s |
| `cascade-fire` | $0.1082 / $0.1045 / $0.1091 | **$0.1072** | 40.4s | $0.0139 / $0.0125 / $0.0138 | $0.0134 | 13.4s |
| `cascade-osha` | $0.5171 / $0.5715 / $0.5462 | **$0.5449** | 192.3s | $0.0498 / $0.0487 / $0.0537 | $0.0508 | 66.3s |
| `cascade-template-12` | $0.5634 / $0.5580 / $0.5704 | **$0.5640** | 98.2s | (not recorded) / (not recorded) / (not recorded) | (not recorded) | 30.1s |
| `cascade-template-13` | $0.1997 / $0.2018 / $0.2058 | **$0.2024** | 43.8s | (not recorded) / (not recorded) / (not recorded) | (not recorded) | 17.5s |

**Total on the 15 baseline runs, from the ledger: $5.3667.**

### `cascade-template-12` — per checklist line

| Line | run 1 | run 2 | run 3 | claude-haiku-4-5 (last run) | The key accepts |
|---|---|---|---|---|---|
| A1 | `on_file` | `on_file` | `on_file` | `on_file` | on_file or stale |
| A2 | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | `stale` | nothing_on_file |
| A3 | `on_file` | `on_file` | `on_file` | `on_file` | on_file |
| A4 | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | nothing_on_file |
| A5 | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | nothing_on_file |
| B1 | `on_file` | `on_file` | `on_file` | `stale` | on_file or stale |
| B2 | **`on_file`** | **`on_file`** | **`on_file`** | `nothing_on_file` | nothing_on_file |
| B3 | `stale` | `stale` | `stale` | `nothing_on_file` | nothing_on_file or stale |
| B4 | `on_file` | `on_file` | `on_file` | `stale` | on_file or stale |
| B5 | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | nothing_on_file |
| B6 | **`nothing_on_file`** | **`nothing_on_file`** | `on_file` | `on_file` | not_a_document_question or on_file |
| C1 | **`on_file`** | `not_a_document_question` | **`on_file`** | `nothing_on_file` | not_a_document_question |
| C2 | **`on_file`** | `not_a_document_question` | **`on_file`** | `nothing_on_file` | not_a_document_question |
| C3 | **`on_file`** | **`on_file`** | **`on_file`** | `nothing_on_file` | not_a_document_question |
| C4 | `stale` | `stale` | `stale` | `on_file` | stale or not_a_document_question |
| C5 | `stale` | `stale` | `stale` | `on_file` | on_file or stale |

### `cascade-template-13` — per checklist line

| Line | run 1 | run 2 | run 3 | claude-haiku-4-5 (last run) | The key accepts |
|---|---|---|---|---|---|
| 1 | `on_file` | `on_file` | `on_file` | `not_a_document_question` | on_file or stale or not_a_document_question |
| 2 | `on_file` | `on_file` | `on_file` | `nothing_on_file` | on_file or stale |
| 3 | `on_file` | `on_file` | `on_file` | `nothing_on_file` | on_file or stale |
| 4 | `on_file` | `on_file` | `on_file` | `nothing_on_file` | on_file or stale |
| 5 | `stale` | `stale` | `stale` | `stale` | stale or not_a_document_question or nothing_on_file |
| 6 | `not_a_document_question` | `not_a_document_question` | `not_a_document_question` | `not_a_document_question` | not_a_document_question |
| 7 | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | not_a_document_question or nothing_on_file |
| 8 | `on_file` | `on_file` | `on_file` | `nothing_on_file` | on_file or nothing_on_file |

