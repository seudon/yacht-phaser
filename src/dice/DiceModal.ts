import DiceBox from "../../vendor/dice-box/dice-box.es.js"

type RollCallback = (values: number[]) => void
type CloseCallback = () => void

const EXTERNAL_THEMES = {
  smooth: "https://cdn.jsdelivr.net/npm/@3d-dice/theme-smooth",
  "smooth-pip": "https://cdn.jsdelivr.net/npm/@3d-dice/theme-smooth-pip",
  gemstone: "https://cdn.jsdelivr.net/npm/@3d-dice/theme-gemstone",
  blueGreenMetal: "https://cdn.jsdelivr.net/npm/@3d-dice/theme-blue-green-metal",
}
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`
const CLOSE_SHIELD_MS = 560
const ABSORBED_EVENTS = ["pointerdown", "pointerup", "click", "touchstart", "touchmove", "touchend", "contextmenu"] as const

export class DiceModal {
  private modalEl: HTMLElement
  private resultEl: HTMLElement
  private diceBox: any = null
  private resultCallback: RollCallback | null = null
  private closeCallback: CloseCallback | null = null
  private rolling = false
  private readyToClose = false
  private closing = false
  private closeTimer: number | null = null

  constructor(selector: string) {
    const modalEl = document.querySelector<HTMLElement>(selector)
    const resultEl = document.querySelector<HTMLElement>("#dice-modal-result")
    if (!modalEl || !resultEl) throw new Error("Dice modal elements are missing")
    this.modalEl = modalEl
    this.resultEl = resultEl
    ABSORBED_EVENTS.forEach((eventName) => {
      this.modalEl.addEventListener(eventName, this.absorbModalEvent, { capture: true, passive: false })
    })
  }

  async init() {
    this.diceBox = new DiceBox({
      container: "#dice-modal-canvas",
      assetPath: ASSET_BASE,
      theme: "smooth",
      themeColor: "#e8f0ff",
      scale: 5.5,
      throwForce: 6,
      gravity: 1,
      friction: 0.78,
      restitution: 0.15,
      externalThemes: EXTERNAL_THEMES,
      preloadThemes: ["smooth-pip"],
    })

    this.diceBox.onRollComplete = (results: any[]) => {
      const values = results.flatMap((group) => group.rolls.map((roll: any) => roll.value))
      this.showResult(values)
      this.resultCallback?.(values)
      this.rolling = false
    }

    await this.diceBox.init()
    this.diceBox.hide()
  }

  onResult(callback: RollCallback) {
    this.resultCallback = callback
  }

  onClose(callback: CloseCallback) {
    this.closeCallback = callback
  }

  roll(count: number) {
    if (!this.diceBox || this.rolling || count <= 0) return
    this.rolling = true
    this.readyToClose = false
    this.closing = false
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
    this.modalEl.classList.remove("closing")
    this.modalEl.classList.remove("hidden")
    this.modalEl.setAttribute("aria-hidden", "false")
    this.resultEl.classList.add("hidden")
    this.resultEl.innerHTML = ""
    this.diceBox.clear()
    this.diceBox.show()

    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"))
      window.setTimeout(() => this.diceBox.roll(`${count}dpip`), 120)
    })
  }

  private close() {
    if (!this.diceBox || this.closing) return
    this.closing = true
    this.readyToClose = false
    this.closeCallback?.()
    this.diceBox.clear()
    this.diceBox.hide()
    this.resultEl.classList.add("hidden")
    this.modalEl.classList.add("closing")
    this.modalEl.setAttribute("aria-hidden", "true")
    this.closeTimer = window.setTimeout(() => {
      this.modalEl.classList.add("hidden")
      this.modalEl.classList.remove("closing")
      this.closing = false
      this.closeTimer = null
    }, CLOSE_SHIELD_MS)
  }

  private showResult(values: number[]) {
    const valuesWrap = document.createElement("div")
    valuesWrap.className = "result-values"

    for (const value of values) {
      const die = document.createElement("span")
      die.className = "result-die"
      die.textContent = String(value)
      valuesWrap.appendChild(die)
    }

    const nextAction = document.createElement("div")
    nextAction.className = "result-next-action"
    nextAction.textContent = "タップしてキープするダイスを選択"

    this.resultEl.innerHTML = ""
    this.resultEl.append(valuesWrap, nextAction)
    this.resultEl.classList.remove("hidden")
    this.readyToClose = true
  }

  private absorbModalEvent = (event: Event) => {
    if (this.modalEl.classList.contains("hidden")) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    if (!this.readyToClose) return
    if (event.type === "pointerup" || event.type === "touchend" || event.type === "click") this.close()
  }
}
