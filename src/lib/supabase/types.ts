export type Theme = "default" | "duotone" | "noir" | "sage" | "blush";

export interface Profile {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  theme: Theme;
  created_at: string;
}

export interface Category {
  id: number;
  slug: string;
  label: string;
  sort_order: number;
}

export interface Item {
  id: string;
  profile_id: string;
  category_id: number;
  title: string;
  by: string | null;
  year: number | null;
  url: string | null;
  image_url: string | null;
  note: string | null;
  featured: boolean;
  source_label: string | null;
  position: number;
  created_at: string;
}

export interface PersonalizeBlock {
  id: string;
  profile_id: string;
  type: "text" | "image";
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  created_at: string;
}

// Minimal hand-written schema shape for the supabase-js client's generics.
// Fine for today's scope — swap for `supabase gen types typescript` output later.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; handle: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category>; Relationships: [] };
      items: {
        Row: Item;
        Insert: Partial<Item> & { profile_id: string; category_id: number; title: string };
        Update: Partial<Item>;
        Relationships: [];
      };
      personalize_blocks: {
        Row: PersonalizeBlock;
        Insert: Partial<PersonalizeBlock> & { profile_id: string; type: "text" | "image"; content: string };
        Update: Partial<PersonalizeBlock>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
