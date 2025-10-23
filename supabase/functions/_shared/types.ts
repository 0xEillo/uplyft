export interface Exercise {
  id: string
  name: string
  muscle_group: string | null
  type: string | null
  equipment: string | null
  created_by: string | null
  created_at: string
  aliases?: string[] | null
  embedding?: number[] | null
}
