import Phaser from "phaser"
import { YachtScene } from "./scenes/YachtScene"
import { DiceModal } from "./dice/DiceModal"
import "./style.css"

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#13211f",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [YachtScene],
})

const diceModal = new DiceModal("#dice-modal")
await diceModal.init()

const scene = game.scene.getScene("YachtScene") as YachtScene
scene.setDiceModal(diceModal)

;(window as any).__PHASER_GAME__ = game
