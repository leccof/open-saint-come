// config.js — configuration de l'accès à Supabase.
//
// Ce fichier EST publié sur GitHub, et c'est normal : le site est entièrement
// statique, donc le navigateur doit pouvoir lire ces deux valeurs pour parler
// à la base de données. La clé « publishable » est conçue pour être publique ;
// la sécurité repose sur les règles RLS définies dans Supabase.
//
// Ne jamais mettre ici la clé « secret » / « service_role ».

export const SUPABASE_URL = 'https://aquljikslmvazvqlotio.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_twKd_-R9X-5l8GNAyoQFQg_WI1_QIhX';

// Nom du tournoi proposé par défaut sur l'écran de configuration.
export const DEFAULT_TOURNAMENT_NAME = 'Open de Saint-Côme';
