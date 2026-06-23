import DiceBox from "../../vendor/dice-box/dice-box.es.js"

type RollCallback = (values: number[]) => void

const EXTERNAL_THEMES = {
  smooth: "https://cdn.jsdelivr.net/npm/@3d-dice/theme-smooth",
  gemstone: "https://cdn.jsdelivr.net/npm/@3d-dice/theme-gemstone",
  blueGreenMetal: "https://cdn.jsdelivr.net/npm/@3d-dice/theme-blue-green-metal",
}

export class DiceModal {
  private modalEl: HTMLElement
  private resultEl: HTMLElement
  private diceBox: any = null
  private resultCallback: RollCallback | null = null
  private rolling = false

  constructor(selector: string) {
    const modalEl = document.querySelector<HTMLElement>(selector)
    const resultEl = document.querySelector<HTMLElement>("#dice-modal-result")
    if (!modalEl || !resultEl) throw new Error("Dice modal elements are missing")
    this.modalEl = modalEl
    this.resultEl = resultEl
  }

  async init() {
    this.diceBox = new DiceBox({
      container: "#dice-modal-canvas",
      assetPath: "/assets/",
      theme: "smooth",
      themeColor: "#e8f0ff",
      scale: 5.5,
      throwForce: 6,
      gravity: 1,
      friction: 0.78,
      restitution: 0.15,
      externalThemes: EXTERNAL_THEMES,
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

  roll(count: number) {
    if (!this.diceBox || this.rolling || count <= 0) return
    this.rolling = true
    this.modalEl.classList.remove("hidden")
    this.modalEl.setAttribute("aria-hidden", "false")
    this.resultEl.classList.add("hidden")
    this.resultEl.innerHTML = ""
    this.diceBox.clear()
    this.diceBox.show()

    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"))
      window.setTimeout(() => this.diceBox.roll(`${count}d6`), 120)
    })
  }

  private close() {
    if (!this.diceBox) return
    this.diceBox.clear()
    this.diceBox.hide()
    this.modalEl.classList.add("hidden")
    this.modalEl.setAttribute("aria-hidden", "true")
    this.resultEl.classList.add("hidden")
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

    const button = document.createElement("button")
    button.className = "close-btn"
    button.type = "button"
    button.textContent = "ゲームへ戻る"
    button.addEventListener("click", () => this.close())

    this.resultEl.innerHTML = ""
    this.resultEl.append(valuesWrap, button)
    this.resultEl.classList.remove("hidden")
  }
}
