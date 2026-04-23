/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/launchpad.json`.
 */
export type Launchpad = {
  "address": "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
  "metadata": {
    "name": "launchpad",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana bonding curve token launchpad"
  },
  "instructions": [
    {
      "name": "buy",
      "docs": [
        "Buy tokens from the bonding curve.",
        "",
        "Transfers SOL (cost + fee) from buyer, mints tokens to buyer's ATA.",
        "If supply crosses graduation_threshold, sets `graduating = true` and",
        "emits GraduationTriggered — client must include `graduate` as the next ix.",
        "",
        "# Arguments",
        "* `amount`       — Token units to buy (6 decimals).",
        "* `max_sol_cost` — Slippage cap: transaction fails if cost > this value."
      ],
      "discriminator": [
        102,
        6,
        61,
        18,
        1,
        218,
        235,
        234
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "Buyer wallet — pays SOL, receives tokens."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenConfig",
          "docs": [
            "Token configuration PDA. Must be Active and not currently graduating."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "SPL Mint for this token."
          ],
          "writable": true
        },
        {
          "name": "solVault",
          "docs": [
            "SOL vault PDA — receives trade proceeds."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "buyerAta",
          "docs": [
            "Buyer's associated token account — receives minted tokens."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "feeVault",
          "docs": [
            "Platform fee vault — receives the buy fee."
          ],
          "writable": true
        },
        {
          "name": "platformConfig",
          "docs": [
            "Platform configuration — read for fee_basis_points."
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "maxSolCost",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelToken",
      "docs": [
        "Cancel a token before any external trades have occurred.",
        "",
        "Only the creator can call this. Closes the sol_vault and token_config,",
        "returning rent to the creator. Creator allocation tokens remain in their ATA."
      ],
      "discriminator": [
        218,
        217,
        51,
        106,
        130,
        11,
        150,
        226
      ],
      "accounts": [
        {
          "name": "creator",
          "docs": [
            "Token creator — must be signer, receives rent refunds."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenConfig",
          "docs": [
            "Token configuration PDA — closed, rent returned to creator."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "SPL Mint — read only for seed derivation."
          ]
        },
        {
          "name": "solVault",
          "docs": [
            "SOL vault — closed, lamports returned to creator."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "graduate",
      "docs": [
        "Graduate a token to Raydium CPMM.",
        "",
        "Must be called immediately after a `buy` that set `graduating = true`.",
        "Mints remaining supply, creates Raydium pool, burns LP tokens,",
        "revokes mint authority, and sets status = Graduated.",
        "",
        "Raydium pool accounts are passed as `remaining_accounts` (positional).",
        "If no remaining_accounts are provided, runs in test mode (no pool created)."
      ],
      "discriminator": [
        45,
        235,
        225,
        181,
        17,
        218,
        64,
        130
      ],
      "accounts": [
        {
          "name": "cranker",
          "docs": [
            "Anyone can crank this — authorization is the `graduating` flag."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenConfig",
          "docs": [
            "Token configuration PDA — must have graduating == true."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "SPL Mint — mint authority is token_config PDA."
          ],
          "writable": true
        },
        {
          "name": "solVault",
          "docs": [
            "SOL vault PDA — holds all bonding curve proceeds."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "programTokenAta",
          "docs": [
            "Temporary program-owned ATA that receives the remaining token mint",
            "before it's deposited into the Raydium pool. Closed after graduation."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "tokenConfig"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "feeVault",
          "docs": [
            "Platform fee vault — receives 0.5% graduation fee."
          ],
          "writable": true
        },
        {
          "name": "platformConfig",
          "docs": [
            "Platform configuration."
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializePlatform",
      "docs": [
        "Initialize the platform configuration PDA.",
        "One-time admin instruction — run once after program deployment.",
        "",
        "# Arguments",
        "* `fee_basis_points` — Platform fee in basis points (max 500 = 5%)."
      ],
      "discriminator": [
        119,
        201,
        101,
        45,
        75,
        122,
        89,
        3
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The platform administrator. Pays for the PDA rent."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "platformConfig",
          "docs": [
            "Platform configuration PDA — created here.",
            "Seeds: `[\"platform_config\"]`"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeVault",
          "docs": [
            "The system account that will receive platform fees.",
            "Must be a valid system-owned account (not a program-owned account).",
            "",
            "transferred in this instruction — validation is caller's responsibility."
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBasisPoints",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeToken",
      "docs": [
        "Deploy a new token on the bonding curve.",
        "",
        "Creates:",
        "- SPL Mint (6 decimals)",
        "- TokenConfig PDA",
        "- SOL Vault PDA",
        "- Metaplex metadata account",
        "",
        "Optionally mints creator_allocation % of supply_cap to creator's ATA."
      ],
      "discriminator": [
        38,
        209,
        150,
        50,
        190,
        117,
        16,
        54
      ],
      "accounts": [
        {
          "name": "creator",
          "docs": [
            "Token creator — pays all rent, receives creator allocation."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "docs": [
            "SPL Mint for the new token. 6 decimals.",
            "PDA seeds: `[\"mint\", creator, symbol]` — ensures symbol uniqueness per creator."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "params.symbol"
              }
            ]
          }
        },
        {
          "name": "tokenConfig",
          "docs": [
            "Per-token configuration PDA.",
            "PDA seeds: `[\"token_config\", mint]`"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "solVault",
          "docs": [
            "SOL vault — holds bonding curve proceeds.",
            "PDA seeds: `[\"vault\", mint]`",
            "Plain PDA that holds SOL. No Anchor data — created on first SOL transfer.",
            "",
            "bump are validated by the constraint below; no data is read or written."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "creatorAta",
          "docs": [
            "Creator's associated token account — receives creator_allocation tokens."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "metadataAccount",
          "docs": [
            "Metaplex metadata account for this mint.",
            ""
          ],
          "writable": true
        },
        {
          "name": "platformConfig",
          "docs": [
            "Platform configuration — read to verify platform is initialized."
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenMetadataProgram",
          "docs": [
            "Metaplex Token Metadata program."
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "initializeTokenParams"
            }
          }
        }
      ]
    },
    {
      "name": "sell",
      "docs": [
        "Sell tokens back to the bonding curve.",
        "",
        "Burns seller's tokens, transfers 95% of equivalent buy cost back as SOL.",
        "The 5% spread is the implicit fee (stays in vault).",
        "",
        "# Arguments",
        "* `amount`         — Token units to sell (6 decimals).",
        "* `min_sol_return` — Slippage floor: transaction fails if return < this value."
      ],
      "discriminator": [
        51,
        230,
        133,
        164,
        1,
        127,
        131,
        173
      ],
      "accounts": [
        {
          "name": "seller",
          "docs": [
            "Seller wallet — receives SOL, loses tokens."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenConfig",
          "docs": [
            "Token configuration PDA. Must be Active."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "SPL Mint for this token — used for burn authority check."
          ],
          "writable": true
        },
        {
          "name": "solVault",
          "docs": [
            "SOL vault PDA — signs the SOL transfer back to seller."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "sellerAta",
          "docs": [
            "Seller's associated token account — tokens burned from here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "seller"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "platformConfig",
          "docs": [
            "Platform configuration — read only (no fee on sells; spread is implicit)."
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "minSolReturn",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawFees",
      "docs": [
        "Withdraw accumulated platform fees from the fee vault.",
        "",
        "Only callable by the platform authority.",
        "",
        "# Arguments",
        "* `amount` — Lamports to withdraw."
      ],
      "discriminator": [
        198,
        212,
        171,
        109,
        144,
        215,
        174,
        89
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Platform authority — must match platform_config.authority."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "platformConfig",
          "docs": [
            "Platform configuration — read for authority validation."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeVault",
          "docs": [
            "Fee vault — source of withdrawal."
          ],
          "writable": true
        },
        {
          "name": "recipient",
          "docs": [
            "Recipient of withdrawn fees (usually same as authority)."
          ],
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "platformConfig",
      "discriminator": [
        160,
        78,
        128,
        0,
        248,
        83,
        230,
        160
      ]
    },
    {
      "name": "tokenConfig",
      "discriminator": [
        92,
        73,
        255,
        43,
        107,
        51,
        117,
        101
      ]
    }
  ],
  "events": [
    {
      "name": "buyEvent",
      "discriminator": [
        103,
        244,
        82,
        31,
        44,
        245,
        119,
        119
      ]
    },
    {
      "name": "graduationEvent",
      "discriminator": [
        10,
        246,
        223,
        127,
        48,
        98,
        149,
        55
      ]
    },
    {
      "name": "graduationTriggered",
      "discriminator": [
        225,
        114,
        140,
        64,
        171,
        27,
        31,
        47
      ]
    },
    {
      "name": "sellEvent",
      "discriminator": [
        62,
        47,
        55,
        10,
        165,
        3,
        220,
        42
      ]
    },
    {
      "name": "tokenCancelled",
      "discriminator": [
        201,
        52,
        90,
        243,
        1,
        65,
        31,
        6
      ]
    },
    {
      "name": "tokenCreated",
      "discriminator": [
        236,
        19,
        41,
        255,
        130,
        78,
        147,
        172
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "tokenNotActive",
      "msg": "Token is not active"
    },
    {
      "code": 6001,
      "name": "supplyCap",
      "msg": "Supply cap exceeded"
    },
    {
      "code": 6002,
      "name": "insufficientFunds",
      "msg": "Insufficient SOL balance"
    },
    {
      "code": 6003,
      "name": "insufficientTokens",
      "msg": "Insufficient token balance"
    },
    {
      "code": 6004,
      "name": "alreadyGraduating",
      "msg": "Token is already graduating"
    },
    {
      "code": 6005,
      "name": "slippageExceeded",
      "msg": "Slippage tolerance exceeded"
    },
    {
      "code": 6006,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6007,
      "name": "invalidCurveParams",
      "msg": "Invalid curve parameters"
    },
    {
      "code": 6008,
      "name": "creatorAllocationTooHigh",
      "msg": "Creator allocation exceeds maximum (10%)"
    },
    {
      "code": 6009,
      "name": "symbolTooLong",
      "msg": "Symbol too long (max 10 chars)"
    },
    {
      "code": 6010,
      "name": "nameTooLong",
      "msg": "Name too long (max 32 chars)"
    },
    {
      "code": 6011,
      "name": "invalidThreshold",
      "msg": "Graduation threshold must be less than supply cap"
    },
    {
      "code": 6012,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6013,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6014,
      "name": "uriTooLong",
      "msg": "URI too long (max 200 chars)"
    },
    {
      "code": 6015,
      "name": "supplyCapTooSmall",
      "msg": "Supply cap too small (min 1000)"
    },
    {
      "code": 6016,
      "name": "feeTooHigh",
      "msg": "Fee too high (max 500 bps)"
    }
  ],
  "types": [
    {
      "name": "buyEvent",
      "docs": [
        "Emitted after every successful buy."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "SPL Mint purchased."
            ],
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "docs": [
              "Buyer wallet."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Token units purchased (6 decimals)."
            ],
            "type": "u64"
          },
          {
            "name": "solCost",
            "docs": [
              "Lamports sent to vault (before fee)."
            ],
            "type": "u64"
          },
          {
            "name": "fee",
            "docs": [
              "Platform fee in lamports."
            ],
            "type": "u64"
          },
          {
            "name": "supplyAfter",
            "docs": [
              "Token supply after this trade."
            ],
            "type": "u64"
          },
          {
            "name": "priceAfter",
            "docs": [
              "Spot price (lamports/token) after this trade."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "curveParams",
      "docs": [
        "On-chain curve parameters, reused across all three curve types.",
        "",
        "Linear:      P(s) = param_a + param_b * s / 1_000_000",
        "param_a = base price in lamports",
        "param_b = slope (lamports per 1M tokens — avoids decimals)",
        "",
        "Exponential: P(s) ≈ param_a * (1 + r*s + (r*s)²/2)   [3-term Taylor]",
        "param_a = initial price in lamports",
        "param_b = growth rate r, scaled by 1_000_000 (r=1000 → 0.001 per token)",
        "",
        "Sigmoid:     Piecewise linear, 7 segments.",
        "param_a = P_max (maximum price, lamports)",
        "param_b = steepness k, scaled by 1_000_000",
        "param_c = midpoint s0 in token units",
        "param_d / param_e = reserved for packed segment data"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paramA",
            "type": "u64"
          },
          {
            "name": "paramB",
            "type": "u64"
          },
          {
            "name": "paramC",
            "type": "u64"
          },
          {
            "name": "paramD",
            "type": "u64"
          },
          {
            "name": "paramE",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "curveType",
      "docs": [
        "Selects which bonding curve formula governs this token's price."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "linear"
          },
          {
            "name": "exponential"
          },
          {
            "name": "sigmoid"
          }
        ]
      }
    },
    {
      "name": "graduationEvent",
      "docs": [
        "Emitted after successful graduation."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "SPL Mint that graduated."
            ],
            "type": "pubkey"
          },
          {
            "name": "raydiumPool",
            "docs": [
              "Raydium pool state account (all zeros when Raydium CPI is skipped in tests)."
            ],
            "type": "pubkey"
          },
          {
            "name": "totalSol",
            "docs": [
              "Total SOL that was in the vault at graduation time."
            ],
            "type": "u64"
          },
          {
            "name": "graduationFee",
            "docs": [
              "Platform graduation fee collected (lamports)."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "graduationTriggered",
      "docs": [
        "Emitted when a buy crosses the graduation threshold.",
        "The graduate instruction is called atomically within the same transaction."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "initializeTokenParams",
      "docs": [
        "Parameters for token creation."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "docs": [
              "Token name (max 32 bytes)."
            ],
            "type": "string"
          },
          {
            "name": "symbol",
            "docs": [
              "Token symbol (max 10 bytes)."
            ],
            "type": "string"
          },
          {
            "name": "uri",
            "docs": [
              "Metaplex metadata URI — IPFS or Arweave (max 200 bytes)."
            ],
            "type": "string"
          },
          {
            "name": "supplyCap",
            "docs": [
              "Total supply cap in token units (6 decimals). Min 1_000."
            ],
            "type": "u64"
          },
          {
            "name": "curveType",
            "docs": [
              "Bonding curve type."
            ],
            "type": {
              "defined": {
                "name": "curveType"
              }
            }
          },
          {
            "name": "curveParams",
            "docs": [
              "Curve shape parameters."
            ],
            "type": {
              "defined": {
                "name": "curveParams"
              }
            }
          },
          {
            "name": "graduationThreshold",
            "docs": [
              "Supply level that triggers Raydium graduation. Must be < supply_cap."
            ],
            "type": "u64"
          },
          {
            "name": "creatorAllocation",
            "docs": [
              "Percentage of supply_cap pre-minted to creator (0–10)."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "platformConfig",
      "docs": [
        "Global platform configuration.",
        "PDA seeds: `[\"platform_config\"]`",
        "Created once by the platform authority at deploy time."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "The wallet that can update fees and withdraw accumulated fees."
            ],
            "type": "pubkey"
          },
          {
            "name": "feeBasisPoints",
            "docs": [
              "Fee charged on every buy/sell, expressed in basis points.",
              "100 = 1%, max 500 (5%)."
            ],
            "type": "u16"
          },
          {
            "name": "feeVault",
            "docs": [
              "System account that receives platform fees."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "Canonical bump for this PDA."
            ],
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved bytes for future protocol upgrades without migration."
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "sellEvent",
      "docs": [
        "Emitted after every successful sell."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "SPL Mint sold."
            ],
            "type": "pubkey"
          },
          {
            "name": "seller",
            "docs": [
              "Seller wallet."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Token units burned (6 decimals)."
            ],
            "type": "u64"
          },
          {
            "name": "solReturn",
            "docs": [
              "Lamports returned to seller (after 5% spread)."
            ],
            "type": "u64"
          },
          {
            "name": "supplyAfter",
            "docs": [
              "Token supply after this trade."
            ],
            "type": "u64"
          },
          {
            "name": "priceAfter",
            "docs": [
              "Spot price (lamports/token) after this trade."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tokenCancelled",
      "docs": [
        "Emitted when a creator cancels their token before any trades."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tokenConfig",
      "docs": [
        "Per-token state account.",
        "PDA seeds: `[\"token_config\", mint_pubkey]`"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "docs": [
              "Wallet that launched this token."
            ],
            "type": "pubkey"
          },
          {
            "name": "mint",
            "docs": [
              "SPL Mint for this token."
            ],
            "type": "pubkey"
          },
          {
            "name": "name",
            "docs": [
              "Human-readable token name (max 32 bytes)."
            ],
            "type": "string"
          },
          {
            "name": "symbol",
            "docs": [
              "Trading symbol (max 10 bytes, e.g. \"BONK\")."
            ],
            "type": "string"
          },
          {
            "name": "uri",
            "docs": [
              "Metaplex metadata URI (max 200 bytes, IPFS or Arweave)."
            ],
            "type": "string"
          },
          {
            "name": "supplyCap",
            "docs": [
              "Maximum tokens that can ever exist (denominated in smallest unit, 6 decimals)."
            ],
            "type": "u64"
          },
          {
            "name": "currentSupply",
            "docs": [
              "Tokens currently in circulation (minted minus burned)."
            ],
            "type": "u64"
          },
          {
            "name": "curveType",
            "docs": [
              "Which bonding curve formula this token uses."
            ],
            "type": {
              "defined": {
                "name": "curveType"
              }
            }
          },
          {
            "name": "curveParams",
            "docs": [
              "Parameters for the selected curve."
            ],
            "type": {
              "defined": {
                "name": "curveParams"
              }
            }
          },
          {
            "name": "graduationThreshold",
            "docs": [
              "When current_supply reaches this value, graduation to Raydium triggers."
            ],
            "type": "u64"
          },
          {
            "name": "solVault",
            "docs": [
              "PDA that holds SOL from trades (seeds: [\"vault\", mint])."
            ],
            "type": "pubkey"
          },
          {
            "name": "status",
            "docs": [
              "Current lifecycle status."
            ],
            "type": {
              "defined": {
                "name": "tokenStatus"
              }
            }
          },
          {
            "name": "creatorAllocation",
            "docs": [
              "Percentage of supply_cap pre-minted to creator (0–10)."
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp (seconds) when the token was created."
            ],
            "type": "i64"
          },
          {
            "name": "graduating",
            "docs": [
              "Guard flag: true while a graduation CPI is in flight.",
              "Prevents re-entrant graduation calls."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "Canonical bump for this PDA."
            ],
            "type": "u8"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved bytes for future fields without account migration."
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "tokenCreated",
      "docs": [
        "On-chain event emitted after successful token creation."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "The SPL Mint address."
            ],
            "type": "pubkey"
          },
          {
            "name": "creator",
            "docs": [
              "Wallet that created this token."
            ],
            "type": "pubkey"
          },
          {
            "name": "symbol",
            "docs": [
              "Trading symbol."
            ],
            "type": "string"
          },
          {
            "name": "curveType",
            "docs": [
              "0=Linear, 1=Exponential, 2=Sigmoid"
            ],
            "type": "u8"
          },
          {
            "name": "supplyCap",
            "docs": [
              "Total supply cap."
            ],
            "type": "u64"
          },
          {
            "name": "graduationThreshold",
            "docs": [
              "Supply level at which graduation triggers."
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tokenStatus",
      "docs": [
        "Lifecycle status of a token."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "graduated"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    }
  ]
};
