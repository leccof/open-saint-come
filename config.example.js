// config.example.js — modèle de configuration.
//
// Si vous récupérez ce projet pour l'utiliser sur votre propre tournoi :
//   1. Créez un projet gratuit sur https://supabase.com
//   2. Dans « Project Settings » → « API Keys », relevez la Project URL
//      et la clé publiable (publishable / anon).
//   3. Copiez ce fichier sous le nom config.js et remplacez les deux valeurs
//      ci-dessous par les vôtres.
//   4. Créez la table « tournaments » avec le SQL fourni dans le README.
//
// La clé publiable est publique par nature : elle part dans le navigateur de
// chaque visiteur. La protection des données se fait avec les règles RLS
// (Row Level Security) de Supabase, jamais en cachant cette clé.
//
// N'utilisez JAMAIS ici la clé « secret » / « service_role ».

export const SUPABASE_URL = 'https://votre-projet.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_XXXXXXXXXXXXXXXXXXXXXXXX';

// Nom du tournoi proposé par défaut sur l'écran de configuration.
export const DEFAULT_TOURNAMENT_NAME = 'Mon tournoi de pétanque';
