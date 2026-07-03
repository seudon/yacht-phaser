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
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`
const GUIDE_CHARACTERS = [
  {
    key: "guide-captain",
    name: "船長",
    asset: `${ASSET_BASE}characters/captain-die.png`,
  },
] as const

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
  private resetConfirmOpen = false
  private inputLockedUntil = 0
  private stats: Stats = { games: 0, best: 0, average: 0, yachts: 0 }
  private guideCharacter = GUIDE_CHARACTERS[0]

  constructor() {
    super({ key: "YachtScene" })
  }

  preload() {
    GUIDE_CHARACTERS.forEach((character) => this.load.image(character.key, character.asset))
  }

  setDiceModal(diceModal: DiceModal) {
    this.diceModal = diceModal
    diceModal.onResult((values) => this.applyRoll(values))
    diceModal.onClose(() => this.lockInputBriefly())
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
    const short = height < 760
    const tall = height >= 860
    const generous = height >= 980
    const pad = short ? 8 : compact ? 10 : 20
    const topH = short ? 44 : compact ? 47 : tall ? 54 : 60
    const diceH = short ? 102 : compact ? 116 : generous ? 104 : tall ? 110 : 124
    const actionH = short ? 48 : compact ? 54 : tall ? 52 : 60
    const statsH = short ? 42 : compact ? 46 : tall ? 52 : 56
    const sectionGap = short ? 5 : 8
    const scoreY = pad + topH + diceH + actionH + sectionGap
    const scoreH = height - scoreY - statsH - pad

    this.drawFeltBackground(width, height)
    this.drawHeader(pad, pad, width - pad * 2, topH)
    this.drawDiceArea(pad, pad + topH, width - pad * 2, diceH)
    this.drawActions(pad, pad + topH + diceH, width - pad * 2, actionH)
    this.drawScoreSheet(pad, scoreY, width - pad * 2, scoreH)
    this.drawStats(pad, height - statsH - pad, width - pad * 2, statsH)
    if (this.resetConfirmOpen) this.drawResetConfirm(width, height)
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
    const tight = h < 46
    this.text(x + 14, y + (tight ? 6 : 8), "Yacht Dice", tight ? 20 : 22, "#fff3d1", "800")
    this.text(x + 14, y + (tight ? 30 : 34), `Round ${this.round}/13`, 12, "#b8c4c2", "700")

    const score = totalScore(this.board)
    this.dangerButton(x + w - 156, y + (tight ? 8 : 10), 72, tight ? 26 : 28, "リセット", () => this.requestReset())
    this.text(x + w - 14, y + (tight ? 0 : 2), `${score}`, tight ? 25 : 27, "#ffffff", "900", 1)
    this.text(x + w - 14, y + (tight ? 28 : 31), "SCORE", 11, "#b8c4c2", "800", 1)
  }

  private drawDiceArea(x: number, y: number, w: number, h: number) {
    this.panel(x, y, w, h, 0x0c1919, 0.78)
    const tight = h < 110
    const availableW = w - 24
    const gap = Math.min(10, availableW * 0.02)
    const size = Math.min(tight ? 60 : 70, (availableW - gap * 4) / 5, h - (tight ? 36 : 45))
    const startX = x + w / 2 - (size * 5 + gap * 4) / 2
    const diceY = y + (tight ? 9 : 15)

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

      if (held) this.text(dx + size / 2, diceY + size + (tight ? 2 : 5), "KEEP", tight ? 9 : 10, "#ffdf88", "900", 0.5)
    }

    const message = this.messageText()
    this.text(x + w / 2, y + h - (tight ? 17 : 22), message, tight ? 11 : 13, "#d7e0dc", "700", 0.5)
  }

  private drawActions(x: number, y: number, w: number, h: number) {
    const buttonH = h < 52 ? 42 : 48
    const by = y + Math.max(3, (h - buttonH) / 2)
    this.button(x, by, w, buttonH, this.rollButtonLabel(), this.canRoll(), () => this.roll())

    const remain = Math.max(0, 3 - this.rollCount)
    this.text(x + w - 12, by + buttonH / 2 - 8, `${this.rollCount}/3  残り${remain}`, h < 52 ? 11 : 12, this.canRoll() ? "#13211f" : "#d0d4d2", "900", 1)
  }

  private drawScoreSheet(x: number, y: number, w: number, h: number) {
    this.panel(x, y, w, h, 0x0e1b1b, 0.88)
    const upper = CATEGORIES.filter((category) => category.section === "upper")
    const lower = CATEGORIES.filter((category) => category.section === "lower")
    const compact = w < 720
    const tight = h < 420
    const tall = h >= 560
    const titleH = tight ? 23 : compact ? 26 : 30
    const innerPad = tight ? 6 : compact ? 8 : tall ? 14 : 12
    const columnGap = tight ? 6 : 10
    const guideW = Math.max(100, Math.min(220, w * 0.34))
    const sheetW = w - innerPad * 2 - columnGap - guideW
    const sheetX = x + innerPad
    const guideX = sheetX + sheetW + columnGap
    const contentY = y + titleH
    const contentH = h - titleH - innerPad
    const sectionTitleH = tight ? 17 : tall ? 22 : 20
    const totalH = tight ? 20 : tall ? 36 : 25
    const sectionGap = tight ? 3 : tall ? 8 : 6
    const fixedH = sectionTitleH * 2 + totalH * 2 + sectionGap
    const minRowH = tight ? 17 : compact ? 19 : 24
    const maxRowH = compact ? 30 : tall ? 58 : 42
    const rowH = Math.max(minRowH, Math.min(maxRowH, (contentH - fixedH) / (upper.length + lower.length)))

    this.text(x + 12, y + (tight ? 5 : 7), "スコアシート", tight ? 13 : 14, "#fff3d1", "900")
    this.drawCategorySection(
      sheetX,
      contentY,
      sheetW,
      rowH,
      sectionTitleH,
      totalH,
      "数字",
      "63点でボーナス +35",
      `数字合計 ${upperTotal(this.board)}  /  ボーナス ${upperBonus(this.board)}`,
      upper,
    )

    const lowerY = contentY + sectionTitleH + upper.length * rowH + totalH + sectionGap
    this.drawCategorySection(
      sheetX,
      lowerY,
      sheetW,
      rowH,
      sectionTitleH,
      totalH,
      "役",
      "",
      `役の合計 ${lowerTotal(this.board)}`,
      lower,
    )
    this.drawGuide(guideX, contentY, guideW, contentH)
  }

  private drawCategorySection(
    x: number,
    y: number,
    w: number,
    rowH: number,
    titleH: number,
    totalH: number,
    title: string,
    note: string,
    total: string,
    categories: typeof CATEGORIES,
  ) {
    const tight = rowH < 19
    this.text(x + 2, y + (tight ? 1 : 2), title, tight ? 12 : 13, "#fff3d1", "900")
    if (note) this.text(x + w - 2, y + (tight ? 2 : 3), note, w < 190 ? 8 : 10, "#b8c4c2", "800", 1)

    const rowsY = y + titleH
    this.drawCategoryColumn(x, rowsY, w, rowH, categories)
    this.badge(x, rowsY + categories.length * rowH, w, totalH - 2, total)
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
      const isSaved = saved !== null
      const fill = isSaved ? 0x243b4a : best ? 0x4b3d1e : selectable ? 0x153b32 : 0x101b1b
      const border = isSaved ? 0x73a9c4 : best ? 0xf0c968 : selectable ? 0x54d6a3 : 0x87918f
      const borderAlpha = isSaved ? 0.72 : best ? 0.95 : selectable ? 0.5 : 0.18
      const marker = isSaved ? 0x73a9c4 : best ? 0xf0c968 : selectable ? 0x54d6a3 : 0x596461

      const row = this.add.graphics()
      row.fillStyle(fill, isSaved || selectable ? 0.98 : 0.58)
      row.lineStyle(best ? 2 : 1, border, borderAlpha)
      row.fillRoundedRect(x, cy, w, rowH - 4, 6)
      row.strokeRoundedRect(x, cy, w, rowH - 4, 6)
      row.fillStyle(marker, isSaved || selectable ? 1 : 0.35)
      row.fillRoundedRect(x + 2, cy + 3, 4, rowH - 10, 2)
      this.layer.add(row)

      const roomy = rowH >= 34
      const labelSize = w < 170 ? 10 : roomy ? 14 : 12
      const labelY = cy + Math.max(3, (rowH - labelSize - 4) / 2)
      const icon = isSaved ? "✓" : best ? "★" : ""
      const labelColor = isSaved ? "#e6f5ff" : best ? "#fff1b8" : selectable ? "#e7fff5" : "#8c9996"
      if (icon) this.text(x + 10, labelY - 1, icon, labelSize + 1, isSaved ? "#9dd9f5" : "#f0c968", "900")
      this.text(x + (icon ? 27 : 11), labelY, category.label, labelSize, labelColor, "800")
      const valueText = isSaved ? String(saved) : preview !== null ? `(${preview})` : "—"
      const valueColor = isSaved ? "#ffffff" : best ? "#ffe38b" : preview !== null ? "#7ce9bb" : "#66726f"
      this.text(x + w - 8, labelY - (roomy ? 1 : 0), valueText, roomy ? 15 : 13, valueColor, "900", 1)

      if (selectable) {
        const zone = this.add.zone(x, cy, w, rowH - 4).setOrigin(0).setInteractive({ useHandCursor: true })
        zone.on("pointerdown", () => this.selectCategory(category.key))
        this.layer.add(zone)
      }
    }
  }

  private drawGuide(x: number, y: number, w: number, h: number) {
    const divider = this.add.graphics()
    divider.lineStyle(1, 0xffffff, 0.12)
    divider.lineBetween(x - 5, y + 3, x - 5, y + h - 3)
    this.layer.add(divider)

    const message = this.guideMessage()
    const bubbleH = Math.min(112, Math.max(84, h * 0.24))
    const bubble = this.add.graphics()
    bubble.fillStyle(0xf7f0df, 0.98)
    bubble.lineStyle(2, 0xe6b85f, 0.7)
    bubble.fillRoundedRect(x, y + 3, w, bubbleH, 8)
    bubble.strokeRoundedRect(x, y + 3, w, bubbleH, 8)
    bubble.fillStyle(0xf7f0df, 0.98)
    bubble.fillTriangle(x + w * 0.42, y + bubbleH + 2, x + w * 0.58, y + bubbleH + 2, x + w * 0.5, y + bubbleH + 15)
    this.layer.add(bubble)

    this.text(x + w / 2, y + 13, message.title, w < 125 ? 9 : 10, "#806225", "900", 0.5)
    const body = this.add
      .text(x + w / 2, y + 34, message.body, {
        fontFamily: FONT,
        fontSize: `${w < 125 ? 11 : 13}px`,
        fontStyle: "900",
        color: "#172421",
        align: "center",
        lineSpacing: 2,
        wordWrap: { width: w - 16, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0)
    this.layer.add(body)

    const characterSpace = Math.max(72, h - bubbleH - 24)
    const characterSize = Math.min(w * 1.28, characterSpace, 190)
    const captain = this.add
      .image(x + w / 2, y + h - 2, this.guideCharacter.key)
      .setOrigin(0.5, 1)
      .setDisplaySize(characterSize, characterSize)
    this.layer.add(captain)
  }

  private guideMessage() {
    if (this.isFinished) {
      return { title: "航海完了！", body: `最終スコア\n${totalScore(this.board)}点` }
    }
    if (this.isRolling) {
      return { title: "ダイス航海中", body: "いい目が出るか\n見届けよう！" }
    }
    if (this.rollCount === 0) {
      return { title: `${this.guideCharacter.name}のヒント`, body: "まずはダイスを\n振ってみよう！" }
    }

    const best = bestAvailable(this.board, this.dice)
    if (!best) return { title: `${this.guideCharacter.name}のヒント`, body: "役を選んで\n確定しよう！" }
    return { title: "現在の最高得点", body: `${best.label}\n${best.score}点` }
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
    if (this.isInputLocked() || this.resetConfirmOpen || !this.canRoll() || !this.diceModal) return
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
    if (this.isInputLocked() || this.resetConfirmOpen || this.rollCount === 0 || this.isFinished || this.isRolling) return
    this.held[index] = !this.held[index]
    this.redraw()
  }

  private selectCategory(category: CategoryKey) {
    if (this.isInputLocked() || this.resetConfirmOpen || this.board[category] !== null || this.rollCount === 0 || this.isFinished) return
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
    this.resetConfirmOpen = false
    this.redraw()
  }

  private requestReset() {
    if (this.isInputLocked() || this.isRolling || this.resetConfirmOpen) return
    this.resetConfirmOpen = true
    this.redraw()
  }

  private cancelReset() {
    this.resetConfirmOpen = false
    this.redraw()
  }

  private canRoll() {
    return !this.isInputLocked() && !this.resetConfirmOpen && !this.isRolling && !this.isFinished && this.rollCount < 3 && this.held.some((held) => !held)
  }

  private lockInputBriefly() {
    this.inputLockedUntil = Date.now() + 750
  }

  private isInputLocked() {
    return Date.now() < this.inputLockedUntil
  }

  private rollButtonLabel() {
    if (this.isFinished) return "ゲーム終了"
    if (this.isRolling) return "ダイスを振っています..."
    if (this.rollCount === 0) return "ダイスを振る"
    return "振り直す"
  }

  private messageText() {
    if (this.isFinished) return `ゲーム終了  最終スコア ${totalScore(this.board)}`
    if (this.rollCount === 0) return "ダイスを振ってラウンド開始"
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
    const roomy = h >= 30
    const g = this.add.graphics()
    g.fillStyle(0x28343e, 1)
    g.lineStyle(2, 0xe6b85f, 0.82)
    g.fillRoundedRect(x, y, w, h, roomy ? 8 : 6)
    g.strokeRoundedRect(x, y, w, h, roomy ? 8 : 6)
    this.layer.add(g)
    const size = h < 21 ? 11 : roomy ? 14 : 12
    this.text(x + w / 2, y + Math.max(3, (h - size) / 2 - 1), label, size, "#ffffff", "900", 0.5)
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

  private dangerButton(x: number, y: number, w: number, h: number, label: string, onTap: () => void) {
    const g = this.add.graphics()
    g.fillStyle(0x5d2728, 0.92)
    g.lineStyle(1, 0xffb4a6, 0.22)
    g.fillRoundedRect(x, y, w, h, 7)
    g.strokeRoundedRect(x, y, w, h, 7)
    this.layer.add(g)
    this.text(x + w / 2, y + h / 2 - 8, label, 11, "#ffd9d3", "900", 0.5)
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true })
    zone.on("pointerdown", onTap)
    this.layer.add(zone)
  }

  private drawResetConfirm(width: number, height: number) {
    const veil = this.add.graphics()
    veil.fillStyle(0x030707, 0.72)
    veil.fillRect(0, 0, width, height)
    this.layer.add(veil)

    const w = Math.min(330, width - 38)
    const h = 170
    const x = (width - w) / 2
    const y = (height - h) / 2
    this.panel(x, y, w, h, 0x152321, 0.98)
    this.text(x + w / 2, y + 24, "リセットしますか？", 18, "#fff3d1", "900", 0.5)
    this.text(x + w / 2, y + 58, "現在のゲーム進行は失われます", 13, "#b8c4c2", "800", 0.5)

    const buttonW = (w - 34) / 2
    this.neutralButton(x + 12, y + 108, buttonW, 42, "続ける", () => this.cancelReset())
    this.confirmDangerButton(x + 22 + buttonW, y + 108, buttonW, 42, "リセット", () => this.resetGame())
  }

  private neutralButton(x: number, y: number, w: number, h: number, label: string, onTap: () => void) {
    const g = this.add.graphics()
    g.fillStyle(0x2c403c, 1)
    g.lineStyle(1, 0xffffff, 0.14)
    g.fillRoundedRect(x, y, w, h, 8)
    g.strokeRoundedRect(x, y, w, h, 8)
    this.layer.add(g)
    this.text(x + w / 2, y + h / 2 - 10, label, 14, "#eff8f5", "900", 0.5)
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true })
    zone.on("pointerdown", onTap)
    this.layer.add(zone)
  }

  private confirmDangerButton(x: number, y: number, w: number, h: number, label: string, onTap: () => void) {
    const g = this.add.graphics()
    g.fillStyle(0xb9433d, 1)
    g.lineStyle(1, 0xffe2dc, 0.24)
    g.fillRoundedRect(x, y, w, h, 8)
    g.strokeRoundedRect(x, y, w, h, 8)
    this.layer.add(g)
    this.text(x + w / 2, y + h / 2 - 10, label, 14, "#fff8f4", "900", 0.5)
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true })
    zone.on("pointerdown", onTap)
    this.layer.add(zone)
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
