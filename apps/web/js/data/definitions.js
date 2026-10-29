// H5 game data: combat definitions and presentation-only boss skill metadata.
window.GAME_DATA = {
  "cards": {
    "turret": {
      "name": "炮台",
      "type": "archer",
      "health": 50,
      "attack": 30,
      "attack_range": 5,
      "move_points": 0,
      "action_points": 1,
      "defense": 0,
      "image": "turret.webp",
      "description": "远程火力输出单位，攻击范围极远但无法移动。",
      "skills": [],
      "tags": [
        "远程",
        "固定"
      ]
    },
    "angel": {
      "name": "天使",
      "type": "healer",
      "health": 80,
      "attack": 10,
      "attack_range": 1,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "angel.webp",
      "description": "团队治疗者，可为队友恢复生命值并提供充能增益。",
      "skills": [
        "charge",
        "holy_light",
        "bless"
      ],
      "tags": [
        "治疗",
        "辅助",
        "充能"
      ]
    },
    "treent_ancient": {
      "name": "古树",
      "type": "tank",
      "health": 90,
      "attack": 15,
      "attack_range": 1,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "treant_ancient.webp",
      "description": "强大的自然守护者，可召唤树人并用藤蔓束缚敌人。",
      "skills": [
        "entangle",
        "summon_treant"
      ],
      "tags": [
        "坦克",
        "召唤",
        "控制"
      ]
    },
    "treant_small": {
      "name": "小树人",
      "type": "tank",
      "health": 30,
      "attack": 10,
      "attack_range": 1,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "treant_small.webp",
      "description": "古树召唤的自然单位，用于阻挡敌人和保护队友。",
      "skills": [],
      "tags": [
        "召唤物",
        "坦克"
      ]
    },
    "knight": {
      "name": "圣殿骑士",
      "type": "tank",
      "health": 90,
      "attack": 18,
      "attack_range": 1,
      "move_points": 1,
      "action_points": 1,
      "defense": 5,
      "start_shield": 30,
      "image": "knight.webp",
      "description": "重甲战士，拥有极高的防御力，可以保护相邻队友。",
      "skills": [
        "shield_wall"
      ],
      "tags": [
        "坦克",
        "防御",
        "保护"
      ]
    },
    "assassin": {
      "name": "暗影刺客",
      "type": "assassin",
      "health": 50,
      "attack": 20,
      "attack_range": 1,
      "move_points": 3,
      "action_points": 1,
      "defense": 0,
      "image": "assassin.webp",
      "description": "高速移动的暗杀者，可以快速切入战场并造成致命伤害。",
      "skills": [
        "backstab",
        "stealth",
        "dart"
      ],
      "tags": [
        "刺客",
        "爆发",
        "机动"
      ]
    },
    "mage": {
      "name": "元素法师",
      "type": "mage",
      "health": 45,
      "attack": 28,
      "attack_range": 3,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "mage.webp",
      "description": "操控元素力量的法师，可以使用火焰和冰霜攻击敌人。",
      "skills": [
        "fireball",
        "frost_nova"
      ],
      "tags": [
        "法师",
        "远程",
        "范围伤害"
      ]
    },
    "cleric": {
      "name": "大牧师",
      "type": "healer",
      "health": 70,
      "attack": 15,
      "attack_range": 2,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "cleric.webp",
      "description": "虔诚的牧师，可以为队友提供护盾与祝福。",
      "skills": [
        "shield",
        "dispel",
        "blessing"
      ],
      "tags": [
        "治疗",
        "护盾"
      ]
    },
    "ranger": {
      "name": "精灵游侠",
      "type": "archer",
      "health": 55,
      "attack": 25,
      "attack_range": 4,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "ranger.webp",
      "description": "精准的弓箭手，可以在远程造成稳定伤害并标记敌人。",
      "skills": [
        "precise_shot",
        "mark_target"
      ],
      "tags": [
        "远程",
        "爆发"
      ]
    },
    "necromancer": {
      "name": "死灵术士",
      "type": "controller",
      "health": 60,
      "attack": 20,
      "attack_range": 2,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "necromancer.webp",
      "description": "操控死亡力量的术士，可以吸取敌人生命并奴役亡者。",
      "skills": [
        "life_drain",
        "finisher"
      ],
      "tags": [
        "控制",
        "吸血",
        "召唤"
      ]
    },
    "berserker": {
      "name": "战斗猫",
      "type": "warrior",
      "health": 90,
      "attack": 25,
      "attack_range": 1,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "berserker.webp",
      "description": "以命换伤的狂战士，血量越低越嗜血。",
      "skills": [
        "rage",
        "bloodlust"
      ],
      "tags": [
        "近战",
        "爆发",
        "吸血"
      ]
    },
    "skeleton": {
      "name": "小骷髅兵",
      "type": "warrior",
      "health": 10,
      "attack": 10,
      "attack_range": 1,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "skeleton.webp",
      "description": "死灵术士补刀后召唤的亡灵仆从。",
      "skills": [],
      "tags": [
        "召唤物",
        "亡灵"
      ]
    },
    "slime": {
      "name": "史莱姆",
      "type": "tank",
      "health": 80,
      "attack": 25,
      "attack_range": 1,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "slime.webp",
      "description": "软体生物，死亡时会分裂成三只小史莱姆。",
      "skills": [
        "mitosis"
      ],
      "tags": [
        "分裂",
        "坦克"
      ]
    },
    "slime_small": {
      "name": "小史莱姆",
      "type": "tank",
      "health": 20,
      "attack": 10,
      "attack_range": 1,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "slime_small.webp",
      "description": "史莱姆分裂出的子体，死亡后会留下史莱姆球。",
      "skills": [
        "fertilizer"
      ],
      "tags": [
        "召唤物",
        "分裂"
      ]
    },
    "golem": {
      "name": "石魔",
      "type": "tank",
      "health": 40,
      "attack": 15,
      "attack_range": 1,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "golem.webp",
      "description": "恶魔陨石召唤的岩石傀儡。",
      "skills": [],
      "tags": [
        "召唤物",
        "亡灵"
      ]
    },
    "chessboard": {
      "name": "棋盘",
      "type": "controller",
      "health": 80,
      "attack": 15,
      "attack_range": 1,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "chessboard.webp",
      "description": "能将敌人拉入决斗空间的神秘棋盘，死亡时散落棋子。",
      "skills": [
        "duel",
        "scatter"
      ],
      "tags": [
        "决斗",
        "召唤"
      ]
    },
    "puppet_master": {
      "name": "傀儡师",
      "type": "controller",
      "health": 70,
      "attack": 10,
      "attack_range": 1,
      "move_points": 1,
      "action_points": 1,
      "defense": 0,
      "image": "puppet_master.webp",
      "description": "操控提线木偶的幕后大师，可召唤傀儡随行作战。",
      "skills": [
        "puppet"
      ],
      "tags": [
        "控制",
        "召唤"
      ]
    },
    "puppet": {
      "name": "傀儡",
      "type": "warrior",
      "health": 35,
      "attack": 10,
      "attack_range": 1,
      "move_points": 0,
      "action_points": 1,
      "defense": 0,
      "image": "puppet.webp",
      "description": "每回合0移动点、1行动点：移动或跟随每步消耗1行动点，移动与攻击二选一。主人两格内可攻击，失联后只能靠近主人；主人阵亡时退场。",
      "skills": [],
      "tags": [
        "召唤物",
        "亡灵"
      ]
    },
    "rook": {
      "name": "车",
      "type": "warrior",
      "health": 80,
      "attack": 20,
      "attack_range": 0,
      "move_points": 0,
      "action_points": 0,
      "defense": 0,
      "image": "rook.webp",
      "description": "直线冲锋的棋子（充能制，上限1）。",
      "skills": [
        "piece_charge",
        "rook_charge"
      ],
      "tags": [
        "召唤物",
        "棋子"
      ]
    },
    "pawn": {
      "name": "兵",
      "type": "warrior",
      "health": 80,
      "attack": 20,
      "attack_range": 0,
      "move_points": 0,
      "action_points": 0,
      "defense": 0,
      "image": "pawn.webp",
      "description": "只能前进或斜击的棋子，走到尽头变为王后（充能制）。",
      "skills": [
        "piece_charge",
        "pawn_act"
      ],
      "tags": [
        "召唤物",
        "棋子"
      ]
    },
    "knight_piece": {
      "name": "马",
      "type": "warrior",
      "health": 80,
      "attack": 20,
      "attack_range": 0,
      "move_points": 0,
      "action_points": 0,
      "defense": 0,
      "image": "knight_piece.webp",
      "description": "走L型的棋子，可向可达位置发射法球（充能制）。",
      "skills": [
        "piece_charge",
        "knight_leap",
        "knight_orb"
      ],
      "tags": [
        "召唤物",
        "棋子"
      ]
    },
    "queen": {
      "name": "王后",
      "type": "warrior",
      "health": 80,
      "attack": 20,
      "attack_range": 0,
      "move_points": 0,
      "action_points": 0,
      "defense": 0,
      "image": "queen.webp",
      "description": "可沿八方向驰骋，或发射无距离限制的法球（充能制）。",
      "skills": [
        "piece_charge",
        "queen_move",
        "queen_orb"
      ],
      "tags": [
        "召唤物",
        "棋子"
      ]
    }
  },
  "skills": {
    "charge": {
      "name": "充能",
      "type": "passive",
      "description": "每回合开始时获得1点充能，最多5点。",
      "icon": "charge.png",
      "effects": [
        {
          "type": "charge",
          "max_charge": 5,
          "per_turn": 1
        }
      ]
    },
    "entangle": {
      "name": "藤蔓缠绕",
      "type": "active",
      "cost": 1,
      "range": 1,
      "usage": "once",
      "description": "用藤蔓束缚目标，使其晕眩4回合。",
      "icon": "entangle.png",
      "effects": [
        {
          "type": "stun",
          "duration": 4
        }
      ]
    },
    "summon_treant": {
      "name": "召唤树人",
      "type": "active",
      "cost": 1,
      "range": 1,
      "usage": "once",
      "description": "在指定位置召唤一个30/10/1的小树人。",
      "icon": "summon_treant.png",
      "effects": [
        {
          "type": "summon",
          "unit": "treant_small",
          "health": 30,
          "attack": 10
        }
      ]
    },
    "holy_light": {
      "name": "圣光术",
      "type": "active",
      "cost": 2,
      "range": 2,
      "self_target": true,
      "description": "治疗目标30点生命值（消耗2充能，可对自己使用）。",
      "icon": "heal.png",
      "requires": "charge",
      "effects": [
        {
          "type": "heal",
          "value": 30
        }
      ]
    },
    "bless": {
      "name": "祈福",
      "type": "active",
      "cost": 2,
      "range": 2,
      "self_target": true,
      "description": "为一名友方套上一次性护盾（消耗2充能，可对自己使用）。",
      "icon": "bless.png",
      "requires": "charge",
      "effects": [
        {
          "type": "one_time_shield"
        }
      ]
    },
    "shield_wall": {
      "name": "盾牌壁垒",
      "type": "active",
      "cost": 1,
      "range": 1,
      "usage": "once",
      "description": "为相邻友军提供永久3点格挡（护甲）。",
      "icon": "shield_wall.png",
      "effects": [
        {
          "type": "buff",
          "stat": "defense",
          "value": 3,
          "duration": "permanent",
          "target": "adjacent"
        }
      ]
    },
    "backstab": {
      "name": "背刺",
      "type": "active",
      "cost": 1,
      "range": 1,
      "usage": "once",
      "description": "从暗处突袭，造成双倍伤害。",
      "icon": "backstab.png",
      "effects": [
        {
          "type": "damage",
          "multiplier": 2.0
        }
      ]
    },
    "fireball": {
      "name": "火球术",
      "type": "active",
      "cost": 1,
      "range": 3,
      "usage": "once",
      "description": "对目标及周围1格内的敌人各造成20点法伤（无视护甲）。",
      "icon": "fireball.png",
      "effects": [
        {
          "type": "aoe_damage",
          "radius": 1,
          "damage": 20,
          "magic": true
        }
      ]
    },
    "frost_nova": {
      "name": "冰霜新星",
      "type": "active",
      "cost": 1,
      "range": 2,
      "usage": "once",
      "description": "冻结周围2格内的所有敌人，使其减速50%，持续5回合。",
      "icon": "frost_nova.png",
      "effects": [
        {
          "type": "slow",
          "value": 0.5,
          "duration": 5,
          "radius": 2
        }
      ]
    },
    "shield": {
      "name": "护盾术",
      "type": "active",
      "cost": 1,
      "range": 2,
      "self_target": true,
      "usage": "once",
      "description": "为目标提供25点护盾量（可对自己使用）。",
      "icon": "shield.png",
      "effects": [
        {
          "type": "shield",
          "value": 25
        }
      ]
    },
    "dispel": {
      "name": "驱散",
      "type": "active",
      "cost": 1,
      "range": 2,
      "self_target": true,
      "description": "移除目标的所有负面状态（可对自己使用）。",
      "icon": "dispel.png",
      "effects": [
        {
          "type": "remove_debuffs"
        }
      ]
    },
    "blessing": {
      "name": "祝福",
      "type": "active",
      "cost": 1,
      "range": 2,
      "self_target": true,
      "description": "祝福目标，攻击+5、护甲+2、生命上限+10，持续3回合（可对自己使用）。",
      "icon": "blessing.png",
      "effects": [
        {
          "type": "buff",
          "stats": {
            "attack": 5,
            "defense": 2,
            "health": 10
          },
          "duration": 3
        }
      ]
    },
    "precise_shot": {
      "name": "精准射击",
      "type": "active",
      "cost": 1,
      "range": 4,
      "usage": "cooldown:3",
      "description": "造成30点伤害，冷却3回合。",
      "icon": "arrow.png",
      "effects": [
        {
          "type": "damage",
          "value": 30
        }
      ]
    },
    "mark_target": {
      "name": "标记目标",
      "type": "active",
      "cost": 1,
      "range": 99,
      "usage": "once",
      "description": "标记全图任意敌人，使其受到的所有伤害提升20%（易伤，本局仅可使用一次）。",
      "icon": "precise_shot.png",
      "effects": [
        {
          "type": "debuff",
          "stat": "damage_taken",
          "value": 1.2,
          "duration": 3
        }
      ]
    },
    "life_drain": {
      "name": "生命吸取",
      "type": "active",
      "cost": 1,
      "range": 2,
      "usage": "once",
      "description": "吸取目标15点生命值（法伤，无视护甲）并恢复自身等量生命。",
      "icon": "life_drain.png",
      "effects": [
        {
          "type": "drain",
          "value": 15,
          "magic": true
        }
      ]
    },
    "rage": {
      "name": "哈气",
      "type": "active",
      "cost": 0,
      "range": 0,
      "usage": "once",
      "description": "进入狂暴状态，攻击力+10，持续3回合。",
      "icon": "rage.png",
      "effects": [
        {
          "type": "buff",
          "stat": "attack",
          "value": 10,
          "duration": 3
        }
      ]
    },
    "bloodlust": {
      "name": "血爪",
      "type": "passive",
      "description": "生命值低于50%时，攻击回复造成伤害50%的生命（打到护盾时不吸血）。",
      "icon": "bloodlust.png",
      "effects": [
        {
          "type": "lifesteal",
          "threshold": 0.5,
          "ratio": 0.5
        }
      ]
    },
    "stealth": {
      "name": "隐匿",
      "type": "active",
      "cost": 0,
      "range": 0,
      "usage": "once",
      "description": "隐匿持续到自己的下下个回合开始；期间无法被敌方普攻和指向技能选中。普攻会提前解除隐匿，范围伤害仍可命中。",
      "icon": "stealth.png",
      "effects": [
        {
          "type": "self_status",
          "status": "stealth",
          "duration": 2
        }
      ]
    },
    "dart": {
      "name": "飞镖",
      "type": "active",
      "cost": 0,
      "range": 2,
      "usage": "once",
      "description": "投掷飞镖，造成20点普通伤害（不消耗行动点）。",
      "icon": "dart.png",
      "effects": [
        {
          "type": "damage",
          "value": 20
        }
      ]
    },
    "finisher": {
      "name": "补刀",
      "type": "passive",
      "description": "自己补刀击杀的敌人会变成小骷髅兵(10/10)。",
      "icon": "finisher.png",
      "effects": [
        {
          "type": "on_kill",
          "effect": "become_skeleton"
        }
      ]
    },
    "mitosis": {
      "name": "无丝分裂",
      "type": "passive",
      "description": "死亡时原地分裂为3只小史莱姆(20/10)。",
      "icon": "mitosis.png",
      "effects": [
        {
          "type": "on_death",
          "effect": "split_into_3"
        }
      ]
    },
    "fertilizer": {
      "name": "养料",
      "type": "passive",
      "description": "死亡后在原地生成史莱姆球，拾取者生命+5、生命上限+5。",
      "icon": "fertilizer.png",
      "effects": [
        {
          "type": "on_death",
          "effect": "spawn_slime_ball"
        }
      ]
    },
    "puppet": {
      "name": "傀儡",
      "type": "active",
      "cost": 1,
      "range": 1,
      "description": "消耗1行动，在自身或相邻格召唤一名35生命/10攻击、0移动点/1行动点的傀儡，当回合可行动；移动或跟随会消耗行动点。每位主人最多4名，两格内可攻击，失联后只能向主人靠拢；主人阵亡时退场。",
      "icon": "skill-puppet-v1.webp",
      "effects": [
        {
          "type": "summon_puppet"
        }
      ]
    },
    "scatter": {
      "name": "散棋",
      "type": "passive",
      "description": "死亡时随机召唤车/兵/马(80/20)之一在死亡位置。",
      "icon": "scatter.png",
      "effects": [
        {
          "type": "on_death",
          "effect": "scatter_piece"
        }
      ]
    },
    "duel": {
      "name": "对弈",
      "type": "active",
      "cost": 1,
      "range": 3,
      "description": "双方立即交替普通攻击最多六次（各三次）；一方倒下即结束，位置不变。",
      "icon": "duel.png",
      "effects": [
        {
          "type": "duel"
        }
      ]
    },
    "piece_charge": {
      "name": "充能",
      "type": "passive",
      "description": "每回合开始时获得1点充能，最多1点；棋子技能消耗1点充能。",
      "icon": "skill-piece-charge-v1.webp",
      "effects": [
        {
          "type": "charge",
          "max_charge": 1,
          "per_turn": 1
        }
      ]
    },
    "rook_charge": {
      "name": "直线冲撞",
      "type": "active",
      "cost": 1,
      "requires": "charge",
      "range": 0,
      "target_type": "line",
      "description": "沿直线移动；若尽头是敌人则撞上去造成伤害并退回前一格（耗1充能）。",
      "icon": "skill-rook-charge-v1.webp",
      "effects": [
        {
          "type": "rook_charge"
        }
      ]
    },
    "pawn_act": {
      "name": "挺进/斜击",
      "type": "active",
      "cost": 1,
      "requires": "charge",
      "range": 0,
      "target_type": "pawn_act",
      "description": "向前移动1格（尽头晋升王后），或攻击前方斜向敌人（耗1充能）。",
      "icon": "skill-pawn-act-v1.webp",
      "effects": [
        {
          "type": "pawn_act"
        }
      ]
    },
    "queen_move": {
      "name": "驰骋",
      "type": "active",
      "cost": 1,
      "requires": "charge",
      "range": 0,
      "target_type": "line8_move",
      "description": "沿横竖斜任意方向移动（路径需畅通，耗1充能）。",
      "icon": "skill-queen-move-v1.webp",
      "effects": [
        {
          "type": "queen_move"
        }
      ]
    },
    "queen_orb": {
      "name": "法球",
      "type": "active",
      "cost": 1,
      "requires": "charge",
      "range": 0,
      "target_type": "line8_hit",
      "description": "沿横竖斜方向发射无距离限制的法球攻击第一个敌人（法伤，耗1充能）。",
      "icon": "orb.png",
      "effects": [
        {
          "type": "queen_orb"
        }
      ]
    },
    "knight_leap": {
      "name": "跳跃",
      "type": "active",
      "cost": 1,
      "requires": "charge",
      "range": 0,
      "target_type": "knight",
      "description": "以L型跳跃到空格（耗1充能）。",
      "icon": "skill-knight-leap-v1.webp",
      "effects": [
        {
          "type": "knight_leap"
        }
      ]
    },
    "knight_orb": {
      "name": "法球",
      "type": "active",
      "cost": 1,
      "requires": "charge",
      "range": 0,
      "target_type": "knight_hit",
      "description": "向L型可达位置的敌人发射法球（法伤，耗1充能）。",
      "icon": "skill-knight-orb-v1.webp",
      "effects": [
        {
          "type": "knight_orb"
        }
      ]
    }
  },
  "skillCards": {
    "heal_aura": {
      "name": "治愈光环",
      "icon": "heal_aura.png",
      "description": "对我方角色使用，光环漂浮在目标头顶：每回合结束时恢复5点生命，并使宿主获得20%免伤。"
    },
    "fire_rain": {
      "name": "火焰雨",
      "icon": "fire_rain.png",
      "description": "依次降下3波火焰雨：每波对目标格造成20点伤害，对相邻格（3x3）造成10点伤害。"
    },
    "demon_meteor": {
      "name": "恶魔陨石",
      "icon": "demon_meteor.png",
      "description": "对目标格造成30点伤害，命中的敌人眩晕2回合，并在该格（若被占则随机邻格）召唤石魔(40/15)。"
    }
  },
  "bossSkills": {
    "warden_slam": {
      "name": "裂地重击",
      "type": "boss",
      "icon": "skill-boss-warden-slam-v1.webp",
      "description": "锁定目标所在整行，给予玩家一个完整回合撤离；下一次红方回合开始造成 22 点法术伤害，狂暴后为 28 点。"
    },
    "furnace_blast": {
      "name": "熔火轰击",
      "type": "boss",
      "icon": "skill-boss-furnace-blast-v1.webp",
      "description": "锁定目标附近 2×2 区域，下一次红方回合开始造成 26 点法术伤害，狂暴后为 32 点。"
    },
    "crown_cross": {
      "name": "王域裁决",
      "type": "boss",
      "icon": "skill-boss-crown-cross-v1.webp",
      "description": "锁定贯穿棋盘的一行与一列形成十字，下一次红方回合开始造成 30 点法术伤害，狂暴后为 36 点。"
    },
    "boss_enrage": {
      "name": "半血狂暴",
      "type": "passive",
      "icon": "skill-boss-enrage-v1.webp",
      "description": "生命不高于一半时，在下一次蓄力进入狂暴，攻击与蓄力技能伤害各增加 6 点，整场只触发一次。"
    }
  }
};

// Campaign enemies are excluded from collection and competitive drafts.
window.GAME_DATA.cards.ember_hero={name:'烬行者',type:'hero',health:110,attack:18,defense:2,attack_range:1,move_points:2,action_points:2,image:'ember-hero-v1.webp',skills:[],tags:['召唤物','战役专属'],description:'余烬独行专属主角。携带三项主动与两项被动，每次首通获得属性点和技能点。'};
(function () {
  const cards=window.GAME_DATA.cards;
  const bosses=[
    ['boss_warden','苔岩守卫','boss-warden-v1.webp',200,20,5,'裂地重击','锁定一整行，下一次红方回合开始造成 22 点法术伤害。'],
    ['boss_furnace','熔炉暴君','boss-furnace-v1.webp',270,24,6,'熔火轰击','锁定目标附近 2×2 区域，下一次红方回合开始造成 26 点法术伤害。'],
    ['boss_crown','虚空王后','boss-crown-v1.webp',340,28,7,'王域裁决','锁定十字区域，下一次红方回合开始造成 30 点法术伤害。']
  ];
  for(const [id,name,image,health,attack,defense,ability,description] of bosses)
    cards[id]={name,image,health,attack,defense,attack_range:1,move_points:1,action_points:1,skills:[],tags:['召唤物','Boss'],size:2,boss:true,ability,description:description+' 半血后狂暴，攻击与预警伤害 +6。预警优先锁定出战角色；普攻同时横扫身边 1 格内所有敌人，对召唤物基础伤害 +15。眩晕最多持续 1 次行动，之后 2 次行动免疫眩晕。'};
})();

(function () {
  for(const [id,ability] of Object.entries({boss_warden:'warden_slam',boss_furnace:'furnace_blast',boss_crown:'crown_cross'}))
    Object.assign(window.GAME_DATA.cards[id],{bossAbility:ability,displaySkills:[ability,'boss_enrage']});
})();
