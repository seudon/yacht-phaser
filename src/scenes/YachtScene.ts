import Phaser from "phaser"
import type { DiceModal } from "../dice/DiceModal"
import {
  CATEGORIES,
  type CategoryKey,
  type ScoreBoard,
  bestAvailable,
  calculateScore,
  emptyScoreBoard,
  lowerTotal,
  totalScore,
  upperBonus,
  upperTotal,
} from "../rules"

type Stats = {
  games: number
  best: number
  average: number
  yachts: number
}

const STORAGE_KEY = "yacht-phaser-stats"
const FONT = '"Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif'

export class YachtScene extends Phaser.Scene {
  private diceModal: DiceModal | null = null
  private layer!: Phaser.GameObjects.Container
  private board: ScoreBoard = emptyScoreBoard()
  private dice = [0, 0, 0, 0, 0]
  private held = [false, false, false, false, false]
  private round = 1
  private rollCount = 0
  private isFinished = false
  private isRolling = false
  private stats: Stats = { games: 0, best: 0, average: 0, yachts: 0 }

  constructor() {
    super({ key: "YachtScene" })
  }

  setDiceModal(diceModal: DiceModal) {
    this.diceModal = diceModal
    diceModal.onResult((values) => this.applyRoll(values))
  }

  create() {
    this.layer = this.add.container(0, 0)
    this.stats = this.loadStats()
    this.scale.on("resize", () => this.redraw())
    this.redraw()
  }

  private redraw() {
    this.layer.removeAll(true)

    const width = this.scale.width
    const height = this.scale.height
    const compact = width < 720
    const pad = compact ? 12 : 20
    const topH = compact ? 48 : 62
    const diceH = compact ? 122 : 155
    const actionH = compact ? 58 : 68
    const statsH = compact ? 48 : 58
    const scoreY = pad + topH + diceH + actionH + 8
    const scoreH = height - scoreY - statsH - pad

    this.drawFeltBackground(width, height)
    this.drawHeader(pad, pad, width - pad * 2, topH)
    this.drawDiceArea(pad, pad + topH, width - pad * 2, diceH)
    this.drawActions(pad, pad + topH + diceH, width - pad * 2, actionH)
    this.drawScoreSheet(pad, scoreY, width - pad * 2, scoreH)
    this.drawStats(pad, height - statsH - pad, width - pad * 2, statsH)
  }

  private drawFeltBackground(width: number, height: number) {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x142522, 0x142522, 0x263a31, 0x0a1515, 1)
    bg.fillRect(0, 0, width, height)
    bg.lineStyle(2, 0xe6b85f, 0.18)
    for (let y = 18; y < height; y += 34) {
      bg.lineBetween(0, y, width, y + 18)
    }
    this.layer.add(bg)
  }

  private drawHeader(x: number, y: number, w: number, h: number) {
    this.panel(x, y, w, h, 0x10201e, 0.9)
    this.text(x + 14, y + 11, "Yacht Dice", 22, "#fff3d1", "800")
    this.text(x + 14, y + 36, `Round ${this.round}/13`, 12, "#b8c4c2", "700")

    const score = totalScore(this.board)
    this.text(x + w - 14, y + 10, `${score}`, 28, "#ffffff", "900", 1)
    this.text(x + w - 14, y + 40, "SCORE", 11, "#b8c4c2", "800", 1)
  }

  private drawDiceArea(x: number, y: number, w: number, h: number) {
    this.panel(x, y, w, h, 0x0c1919, 0.78)
    const availableW = w - 24
    const gap = Math.min(10, availableW * 0.02)
    const size = Math.min(70, (availableW - gap * 4) / 5, h - 45)
    const startX = x + w / 2 - (size * 5 + gap * 4) / 2
    const diceY = y + 15

    for (let i = 0; i < 5; i++) {
      const dx = startX + i * (size + gap)
      const value = this.dice[i]
      const held = this.held[i]
      const die = this.add.graphics()
      die.fillStyle(held ? 0xe6b85f : 0xf6f1e6, 1)
      die.lineStyle(held ? 3 : 2, held ? 0xffdf88 : 0x2e3a38, 1)
      die.fillRoundedRect(dx, diceY, size, size, 10)
      die.strokeRoundedRect(dx, diceY, size, size, 10)
      this.layer.add(die)

      if (value > 0) this.drawPips(dx, diceY, size, value, held ? 0x1b2a29 : 0x111817)
      else this.text(dx + size / 2, diceY + size / 2 - 13, "?", 34, "#73817d", "900", 0.5)

      const zone = this.add.zone(dx, diceY, size, size).setOrigin(0).setInteractive({ useHandCursor: true })
      zone.on("pointerdown", () => this.toggleHold(i))
      this.layer.add(zone)

      if (held) this.text(dx + size / 2, diceY + size + 5, "KEEP", 10, "#ffdf88", "900", 0.5)
    }

    const message = this.messageText()
    this.text(x + w / 2, y + h - 22, message, 13, "#d7e0dc", "700", 0.5)
  }

  private drawActions(x: number, y: number, w: number, h: number) {
    const rollW = Math.min(250, w * 0.58)
    const resetW = Math.min(128, w - rollW - 10)
    const by = y + Math.max(6, (h - 48) / 2)
    this.button(x, by, rollW, 48, this.rollButtonLabel(), this.canRoll(), () => this.roll())
    this.button(x + rollW + 10, by, resetW, 48, "NEW", true, () => this.resetGame())

    const remain = Math.max(0, 3 - this.rollCount)
    this.text(x + w - 2, by + 16, `Roll ${this.rollCount}/3  残り${remain}`, 12, "#b8c4c2", "800", 1)
  }

  private drawScoreSheet(x: number, y: number, w: number, h: number) {
    this.panel(x, y, w, h, 0x0e1b1b, 0.88)
    const upper = CATEGORIES.filter((category) => category.section === "upper")
    const lower = CATEGORIES.filter((category) => category.section === "lower")
    const titleH = 26
    const totalsH = 48
    const rowH = Math.max(24, Math.min(34, (h - titleH - totalsH) / 8))
    const colGap = 8
    const colW = (w - 22 - colGap) / 2
    const leftX = x + 11
    const rightX = leftX + colW + colGap
    const topY = y + titleH

    this.text(x + 12, y + 7, "Score Sheet", 14, "#fff3d1", "900")
    this.text(x + w - 12, y + 7, "上段63点で +35", 11, "#b8c4c2", "800", 1)
    this.drawCategoryColumn(leftX, topY, colW, rowH, upper)
    this.drawCategoryColumn(rightX, topY, colW, rowH, lower)

    const totalY = y + h - totalsH + 6
    const upperText = `上段 ${upperTotal(this.board)} + ${upperBonus(this.board)}`
    const lowerText = `下段 ${lowerTotal(this.board)}`
    this.badge(leftX, totalY, colW, 32, upperText)
    this.badge(rightX, totalY, colW, 32, lowerText)
  }

  private drawCategoryColumn(
    x: number,
    y: number,
    w: number,
    rowH: number,
    categories: typeof CATEGORIES,
  ) {
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i]
      const cy = y + i * rowH
      const saved = this.board[category.key]
      const selectable = saved === null && this.rollCount > 0 && !this.isFinished
      const preview = selectable ? calculateScore(category.key, this.dice) : null
      const best = selectable && bestAvailable(this.board, this.dice)?.key === category.key
      const fill = saved !== null ? 0x18352f : best ? 0x314229 : 0x122423
      const alpha = selectable || saved !== null ? 0.96 : 0.48

      const row = this.add.graphics()
      row.fillStyle(fill, alpha)
      row.lineStyle(1, best ? 0xe6b85f : 0xffffff, best ? 0.62 : 0.1)
      row.fillRoundedRect(x, cy, w, rowH - 4, 6)
      row.strokeRoundedRect(x, cy, w, rowH - 4, 6)
      this.layer.add(row)

      const labelSize = w < 170 ? 10 : 12
      this.text(x + 8, cy + 6, category.label, labelSize, "#edf7f4", "800")
      const valueText = saved !== null ? String(saved) : preview !== null ? `(${preview})` : "-"
      const valueColor = saved !== null ? "#fff3d1" : preview !== null ? "#90f0c2" : "#74827f"
      this.text(x + w - 8, cy + 6, valueText, 13, valueColor, "900", 1)

      if (selectable) {
        const zone = this.add.zone(x, cy, w, rowH - 4).setOrigin(0).setInteractive({ useHandCursor: true })
        zone.on("pointerdown", () => this.selectCategory(category.key))
        this.layer.add(zone)
      }
    }
  }

  private drawStats(x: number, y: number, w: number, h: number) {
    this.panel(x, y, w, h, 0x10201e, 0.84)
    const items = [
      ["BEST", this.stats.best || "-"],
      ["AVG", this.stats.games ? this.stats.average.toFixed(1) : "-"],
      ["PLAY", this.stats.games],
      ["YACHT", this.stats.yachts],
    ]
    const cellW = w / items.length
    items.forEach(([label, value], i) => {
      const cx = x + cellW * i + cellW / 2
      this.text(cx, y + 8, String(label), 10, "#b8c4c2", "900", 0.5)
      this.text(cx, y + 24, String(value), 17, "#ffffff", "900", 0.5)
    })
  }

  private roll() {
    if (!this.canRoll() || !this.diceModal) return
    const rollIndexes = this.dice.map((_, i) => i).filter((i) => !this.held[i])
    if (rollIndexes.length === 0) return
    this.isRolling = true
    this.redraw()
    this.diceModal.roll(rollIndexes.length)
  }

  private applyRoll(values: number[]) {
    const rollIndexes = this.dice.map((_, i) => i).filter((i) => !this.held[i])
    rollIndexes.forEach((index, offset) => {
      this.dice[index] = values[offset] ?? Phaser.Math.Between(1, 6)
    })
    this.rollCount += 1
    this.isRolling = false
    this.redraw()
  }

  private toggleHold(index: number) {
    if (this.rollCount === 0 || this.isFinished || this.isRolling) return
    this.held[index] = !this.held[index]
    this.redraw()
  }

  private selectCategory(category: CategoryKey) {
    if (this.board[category] !== null || this.rollCount === 0 || this.isFinished) return
    const score = calculateScore(category, this.dice)
    this.board[category] = score
    if (category === "yacht" && score === 50) this.stats.yachts += 1

    if (this.round >= 13) {
      this.finishGame()
      return
    }

    this.round += 1
    this.rollCount = 0
    this.held = [false, false, false, false, false]
    this.dice = [0, 0, 0, 0, 0]
    this.redraw()
  }

  private finishGame() {
    this.isFinished = true
    const finalScore = totalScore(this.board)
    const games = this.stats.games + 1
    this.stats = {
      games,
      best: Math.max(this.stats.best, finalScore),
      average: Math.round(((this.stats.average * this.stats.games + finalScore) / games) * 10) / 10,
      yachts: this.stats.yachts,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats))
    this.redraw()
  }

  private resetGame() {
    this.board = emptyScoreBoard()
    this.dice = [0, 0, 0, 0, 0]
    this.held = [false, false, false, false, false]
    this.round = 1
    this.rollCount = 0
    this.isFinished = false
    this.isRolling = false
    this.redraw()
  }

  private canRoll() {
    return !this.isRolling && !this.isFinished && this.rollCount < 3 && this.held.some((held) => !held)
  }

  private rollButtonLabel() {
    if (this.isFinished) return "FINISHED"
    if (this.isRolling) return "ROLLING..."
    if (this.rollCount === 0) return "ROLL DICE"
    return "REROLL"
  }

  private messageText() {
    if (this.isFinished) return `ゲーム終了  最終スコア ${totalScore(this.board)}`
    if (this.rollCount === 0) return "ROLL DICE でラウンド開始"
    const best = bestAvailable(this.board, this.dice)
    return best ? `タップでキープ / おすすめ: ${best.label} ${best.score}点` : "役を選んで確定"
  }

  private loadStats(): Stats {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? { ...this.stats, ...JSON.parse(raw) } : this.stats
    } catch {
      return this.stats
    }
  }

  private panel(x: number, y: number, w: number, h: number, color: number, alpha: number) {
    const g = this.add.graphics()
    g.fillStyle(color, alpha)
    g.lineStyle(1, 0xffffff, 0.13)
    g.fillRoundedRect(x, y, w, h, 8)
    g.strokeRoundedRect(x, y, w, h, 8)
    this.layer.add(g)
  }

  private badge(x: number, y: number, w: number, h: number, label: string) {
    const g = this.add.graphics()
    g.fillStyle(0x1a302d, 0.96)
    g.lineStyle(1, 0xe6b85f, 0.26)
    g.fillRoundedRect(x, y, w, h, 6)
    g.strokeRoundedRect(x, y, w, h, 6)
    this.layer.add(g)
    this.text(x + w / 2, y + 9, label, 12, "#fff3d1", "900", 0.5)
  }

  private button(x: number, y: number, w: number, h: number, label: string, enabled: boolean, onTap: () => void) {
    const g = this.add.graphics()
    g.fillStyle(enabled ? 0xe6b85f : 0x56605d, 1)
    g.lineStyle(1, 0xffffff, enabled ? 0.18 : 0.08)
    g.fillRoundedRect(x, y, w, h, 8)
    g.strokeRoundedRect(x, y, w, h, 8)
    this.layer.add(g)
    this.text(x + w / 2, y + h / 2 - 11, label, 15, enabled ? "#13211f" : "#d0d4d2", "900", 0.5)
    if (enabled) {
      const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true })
      zone.on("pointerdown", onTap)
      this.layer.add(zone)
    }
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    weight: string,
    originX = 0,
  ) {
    const text = this.add
      .text(x, y, value, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: weight,
        color,
      })
      .setOrigin(originX, 0)
    this.layer.add(text)
    return text
  }

  private drawPips(x: number, y: number, size: number, value: number, color: number) {
    const g = this.add.graphics()
    g.fillStyle(color, 1)
    const r = Math.max(4, size * 0.07)
    const left = x + size * 0.28
    const mid = x + size * 0.5
    const right = x + size * 0.72
    const top = y + size * 0.28
    const center = y + size * 0.5
    const bottom = y + size * 0.72
    const pip = (px: number, py: number) => g.fillCircle(px, py, r)

    if ([1, 3, 5].includes(value)) pip(mid, center)
    if (value >= 2) {
      pip(left, top)
      pip(right, bottom)
    }
    if (value >= 4) {
      pip(right, top)
      pip(left, bottom)
    }
    if (value === 6) {
      pip(left, center)
      pip(right, center)
    }
    this.layer.add(g)
  }
}
