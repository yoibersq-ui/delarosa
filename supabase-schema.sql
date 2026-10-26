-- =========================================================================
-- ESQUEMA OFICIAL SUPABASE PARA DELAROSA NAIL DESIGNER
-- Copia y pega todo este código en el "SQL Editor" de tu proyecto en Supabase
-- y haz clic en "RUN".
-- =========================================================================

-- 1. Tabla de Citas (Appointments)
CREATE TABLE IF NOT EXISTS public.appointments (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_email TEXT,
    client_instagram TEXT,
    gender TEXT DEFAULT 'woman',
    is_first_time BOOLEAN DEFAULT true,
    service_id TEXT,
    service_name TEXT,
    shape TEXT,
    length TEXT,
    design_level TEXT,
    design_notes TEXT,
    addons JSONB DEFAULT '[]'::jsonb,
    ambience JSONB DEFAULT '{}'::jsonb,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    duration_min INTEGER DEFAULT 120,
    total_price NUMERIC DEFAULT 0,
    deposit_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'confirmed',
    images JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Servicios del Catálogo (Services)
CREATE TABLE IF NOT EXISTS public.services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    duration_min INTEGER DEFAULT 120,
    description TEXT,
    category TEXT DEFAULT 'manicura',
    is_popular BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Adicionales (Addons)
CREATE TABLE IF NOT EXISTS public.addons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    duration_min INTEGER DEFAULT 15,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Horarios Bloqueados (Blocked Slots)
CREATE TABLE IF NOT EXISTS public.blocked_slots (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    start_time TEXT,
    end_time TEXT,
    reason TEXT DEFAULT 'Horario no disponible',
    is_full_day BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Finanzas y Meta del Estudio
CREATE TABLE IF NOT EXISTS public.finances (
    id TEXT PRIMARY KEY DEFAULT 'studio_finances',
    goal NUMERIC DEFAULT 1000000,
    saved NUMERIC DEFAULT 350000,
    goal_name TEXT DEFAULT 'Mueble Organizador Profesional',
    movements JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabla de Ajustes Generales
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- HABILITAR POLÍTICAS DE ACCESO PÚBLICO (RLS)
-- Permite que la app web (celular y PC) lea y guarde datos sin requerir login
-- =========================================================================

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon public access appointments" ON public.appointments;
CREATE POLICY "Anon public access appointments" ON public.appointments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon public access services" ON public.services;
CREATE POLICY "Anon public access services" ON public.services FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon public access addons" ON public.addons;
CREATE POLICY "Anon public access addons" ON public.addons FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon public access blocked_slots" ON public.blocked_slots;
CREATE POLICY "Anon public access blocked_slots" ON public.blocked_slots FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon public access finances" ON public.finances;
CREATE POLICY "Anon public access finances" ON public.finances FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon public access settings" ON public.settings;
CREATE POLICY "Anon public access settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- HABILITAR TIEMPO REAL (REALTIME)
-- Notifica automáticamente a celulares y PC de cualquier cambio al instante
-- =========================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.addons;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_slots;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finances;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
