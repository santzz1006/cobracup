-- SQL de Configuração Inicial do Banco de Dados - Cobra Cup

-- 1. Criação da Tabela de Perfis (Profiles)
-- Esta tabela guarda o saldo (coins) e o avatar do usuário.
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT NOT NULL,
  coin_balance INTEGER DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativando RLS (Row Level Security) para Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perfis publicos sao visiveis por todos" ON profiles FOR SELECT USING (true);
CREATE POLICY "Usuarios podem inserir seu proprio perfil" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuarios podem atualizar seu proprio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Criação da Tabela de Partidas (Matches)
-- Esta tabela armazena a estrutura do chaveamento.
CREATE TABLE matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player1_name TEXT NOT NULL,
  player2_name TEXT NOT NULL,
  score_p1 INTEGER,
  score_p2 INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'finished')),
  winner TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativando RLS para Matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partidas sao visiveis por todos" ON matches FOR SELECT USING (true);
-- Nota: Para cadastrar partidas, use o painel admin do Supabase (SQL Editor ou Table Editor).

-- 3. Criação da Tabela de Apostas (Bets)
-- Esta tabela guarda o histórico de apostas dos usuários.
CREATE TABLE bets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  match_id UUID REFERENCES matches(id) NOT NULL,
  predicted_winner TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativando RLS para Bets
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios visualizam apenas suas proprias apostas" ON bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuarios inserem apenas suas proprias apostas" ON bets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Função Automática para criar Perfil ao se Cadastrar
-- Este gatilho cria uma linha na tabela profiles quando um novo usuário se registra no Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, coin_balance)
  VALUES (new.id, split_part(new.email, '@', 1), 0);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Inserir Confrontos Iniciais (Oitavas de Final)
-- Usamos 'interval' para garantir que cada partida tenha um created_at ligeiramente diferente e a ordem na UI fique exata.
INSERT INTO matches (player1_name, player2_name, status, created_at) VALUES
  ('Victor', 'Mendes', 'pending', now()),
  ('Davi', 'Guilherme', 'pending', now() + interval '1 second'),
  ('Douglas', 'Gb', 'pending', now() + interval '2 seconds'),
  ('Miguel', 'Yan', 'pending', now() + interval '3 seconds'),
  ('Renato', 'Gabriel', 'pending', now() + interval '4 seconds'),
  ('Vinícius', 'Robson', 'pending', now() + interval '5 seconds'),
  ('Neilan', 'Nathan', 'pending', now() + interval '6 seconds'),
  ('Rodolfo', 'Hey', 'pending', now() + interval '7 seconds');
