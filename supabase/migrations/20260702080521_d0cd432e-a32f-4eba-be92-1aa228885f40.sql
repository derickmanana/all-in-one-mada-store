
INSERT INTO public.categories (name, slug, icon) VALUES
('Électroménager','electromenager','🔌'),
('Informatique','informatique','💻'),
('Téléphonie','telephonie','📞'),
('Bébé & Enfants','bebe-enfants','🍼'),
('Jouets','jouets','🧸'),
('Santé','sante','💊'),
('Bijoux & Montres','bijoux-montres','💍'),
('Chaussures','chaussures','👟'),
('Sacs & Accessoires','sacs-accessoires','👜'),
('Auto & Moto','auto-moto','🏍️'),
('Bricolage','bricolage','🔧'),
('Jardin','jardin','🌱'),
('Artisanat Malagasy','artisanat','🪡'),
('Épicerie','epicerie','🛒'),
('Boissons','boissons','🥤'),
('Livres','livres','📚')
ON CONFLICT (slug) DO NOTHING;
