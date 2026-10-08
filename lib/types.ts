// Tipos fortes do domínio. Espelham as tabelas em supabase/migrations.

export type StoryStatus = 'draft' | 'ready' | 'playing' | 'completed' | 'archived'

export interface StoryTag {
  id: string
  story_id: string
  name: string
  prompt: string
}

export interface Story {
  id: string
  user_id: string
  title: string
  description: string
  genre: string
  tone: string
  status: StoryStatus
  cover_url: string | null
  editor_step: number
  created_at: string
  updated_at: string
  started_at: string | null
  last_played_at: string | null
}

export interface World {
  id?: string
  story_id: string
  world_name: string
  description: string
  era: string
  starting_location: string
  world_rules: string
  atmosphere: string
  important_information: string
}

export interface Scenario {
  id: string
  story_id: string
  name: string
  description: string
  image_url: string | null
  image_path: string | null
  image_prompt: string | null
  is_starting_scenario: boolean
}

export interface MasterSettings {
  id?: string
  story_id: string
  master_prompt: string
  narrative_style: string
  narrator_personality: string
  continuity_rules: string
  character_rules: string
  player_character_rules: string
  pacing_rules: string
  romance_rules: string
  humor_rules: string
  violence_rules: string
  mystery_rules: string
  additional_rules: string
}

export interface Character {
  expressions?: Record<string, string>
  relationship?: any
  id: string
  story_id: string
  name: string
  nickname: string
  age: string
  appearance: string
  personality: string
  history: string
  speech_style: string
  goals: string
  fears: string
  secrets: string
  relationship_to_protagonist: string
  extra_information: string
  image_url: string | null
  image_path: string | null
}

export interface PlayerCharacter {
  id?: string
  story_id: string
  user_id?: string
  name: string
  nickname: string
  age: string
  appearance: string
  personality: string
  history: string
  goals: string
  fears: string
  extra_information: string
  image_url: string | null
  image_path: string | null
}

export type SenderType = 'player' | 'npc' | 'narrator' | 'system'
export type MessageType = 'dialogue' | 'narration' | 'action' | 'scene_change' | 'system'

export interface StoryMessage {
  id: string
  story_id: string
  sequence_number: number
  sender_type: SenderType
  character_id: string | null
  content: string
  message_type: MessageType
  expression: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface StoryState {
  story_id: string
  current_scenario_id: string | null
  current_location: string
  current_chapter: number
  current_scene: number
  story_time: string
  state_data: Record<string, unknown>
}

export interface StoryMemory {
  id: string
  story_id: string
  memory_type: string
  content: string
  importance: number
  created_at: string
}

export interface Relationship {
  id: string
  story_id: string
  character_a_id: string
  character_b_id: string | null
  relationship_type: string
  relationship_value: number | null
  description: string
}

/** Resposta da Edge Function generate-story-response (já validada pelo backend). */
export interface GeminiResponse {
  messages: StoryMessage[]
  state: StoryState
  scenario_changed: boolean
  memories_saved: number
}

export interface StoryBundle {
  tags?: StoryTag[]
  story: Story
  world: World
  master: MasterSettings
  scenarios: Scenario[]
  characters: Character[]
  player: PlayerCharacter
}
