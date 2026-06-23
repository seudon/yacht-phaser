export type CategoryKey =
  | "ones"
  | "twos"
  | "threes"
  | "fours"
  | "fives"
  | "sixes"
  | "threeOfKind"
  | "fourOfKind"
  | "fullHouse"
  | "smallStraight"
  | "largeStraight"
  | "yacht"
  | "chance"

export type ScoreBoard = Record<CategoryKey, number | null>

export const CATEGORIES: Array<{
  key: CategoryKey
  label: string
  short: string
  section: "upper" | "lower"
}> = [
  { key: "ones", label: "1の目", short: "1", section: "upper" },
  { key: "twos", label: "2の目", short: "2", section: "upper" },
  { key: "threes", label: "3の目", short: "3", section: "upper" },
  { key: "fours", label: "4の目", short: "4", section: "upper" },
  { key: "fives", label: "5の目", short: "5", section: "upper" },
  { key: "sixes", label: "6の目", short: "6", section: "upper" },
  { key: "threeOfKind", label: "スリーカード", short: "3C", section: "lower" },
  { key: "fourOfKind", label: "フォーカード", short: "4C", section: "lower" },
  { key: "fullHouse", label: "フルハウス", short: "FH", section: "lower" },
  { key: "smallStraight", label: "S.ストレート", short: "SS", section: "lower" },
  { key: "largeStraight", label: "L.ストレート", short: "LS", section: "lower" },
  { key: "yacht", label: "ヨット", short: "Y", section: "lower" },
  { key: "chance", label: "チャンス", short: "C", section: "lower" },
]

export const emptyScoreBoard = (): ScoreBoard => ({
  ones: null,
  twos: null,
  threes: null,
  fours: null,
  fives: null,
  sixes: null,
  threeOfKind: null,
  fourOfKind: null,
  fullHouse: null,
  smallStraight: null,
  largeStraight: null,
  yacht: null,
  chance: null,
})

export function calculateScore(category: CategoryKey, values: number[]): number {
  switch (category) {
    case "ones":
      return numberScore(values, 1)
    case "twos":
      return numberScore(values, 2)
    case "threes":
      return numberScore(values, 3)
    case "fours":
      return numberScore(values, 4)
    case "fives":
      return numberScore(values, 5)
    case "sixes":
      return numberScore(values, 6)
    case "threeOfKind":
      return hasCount(values, 3) ? total(values) : 0
    case "fourOfKind":
      return hasCount(values, 4) ? total(values) : 0
    case "fullHouse":
      return isFullHouse(values) ? 25 : 0
    case "smallStraight":
      return isSmallStraight(values) ? 30 : 0
    case "largeStraight":
      return isLargeStraight(values) ? 40 : 0
    case "yacht":
      return new Set(values).size === 1 ? 50 : 0
    case "chance":
      return total(values)
  }
}

export function upperTotal(board: ScoreBoard): number {
  return ["ones", "twos", "threes", "fours", "fives", "sixes"].reduce(
    (sum, key) => sum + (board[key as CategoryKey] ?? 0),
    0,
  )
}

export function upperBonus(board: ScoreBoard): number {
  return upperTotal(board) >= 63 ? 35 : 0
}

export function lowerTotal(board: ScoreBoard): number {
  return [
    "threeOfKind",
    "fourOfKind",
    "fullHouse",
    "smallStraight",
    "largeStraight",
    "yacht",
    "chance",
  ].reduce((sum, key) => sum + (board[key as CategoryKey] ?? 0), 0)
}

export function totalScore(board: ScoreBoard): number {
  return upperTotal(board) + upperBonus(board) + lowerTotal(board)
}

export function bestAvailable(board: ScoreBoard, values: number[]) {
  return CATEGORIES.filter((category) => board[category.key] === null)
    .map((category) => ({
      ...category,
      score: calculateScore(category.key, values),
    }))
    .sort((a, b) => b.score - a.score)[0]
}

function numberScore(values: number[], target: number): number {
  return values.filter((value) => value === target).length * target
}

function total(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0)
}

function counts(values: number[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1)
  return map
}

function hasCount(values: number[], amount: number): boolean {
  return Array.from(counts(values).values()).some((count) => count >= amount)
}

function isFullHouse(values: number[]): boolean {
  const grouped = Array.from(counts(values).values()).sort((a, b) => a - b)
  return grouped.length === 2 && grouped[0] === 2 && grouped[1] === 3
}

function isSmallStraight(values: number[]): boolean {
  const unique = Array.from(new Set(values))
  return [
    [1, 2, 3, 4],
    [2, 3, 4, 5],
    [3, 4, 5, 6],
  ].some((straight) => straight.every((value) => unique.includes(value)))
}

function isLargeStraight(values: number[]): boolean {
  const unique = Array.from(new Set(values)).sort().join("")
  return unique === "12345" || unique === "23456"
}
