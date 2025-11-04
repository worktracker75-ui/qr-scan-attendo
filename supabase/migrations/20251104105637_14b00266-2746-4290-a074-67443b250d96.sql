-- Create role enum
create type public.app_role as enum ('admin', 'employee');

-- Create user_roles table for role management
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamp with time zone default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security definer function to check roles
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Create profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

-- Create students table
create table public.students (
  id uuid primary key default gen_random_uuid(),
  roll text not null,
  name text not null,
  enrollment text not null unique,
  email text,
  phone text,
  sem text,
  college text,
  section text,
  system_no text,
  qr_signature text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);

alter table public.students enable row level security;

-- Create sessions table
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  lab_no text not null,
  section text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);

alter table public.sessions enable row level security;

-- Create attendance table
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade not null,
  session_id uuid references public.sessions(id) on delete cascade not null,
  system_no text not null,
  scanned_by uuid references auth.users(id) on delete set null,
  timestamp timestamp with time zone default now(),
  unique (student_id, session_id)
);

alter table public.attendance enable row level security;

-- RLS Policies for user_roles
create policy "Users can view their own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "Admins can view all roles"
  on public.user_roles for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can insert roles"
  on public.user_roles for insert
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update roles"
  on public.user_roles for update
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete roles"
  on public.user_roles for delete
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- RLS Policies for students (admin and employee access)
create policy "Admin and employees can view students"
  on public.students for select
  using (
    public.has_role(auth.uid(), 'admin') or 
    public.has_role(auth.uid(), 'employee')
  );

create policy "Admin and employees can insert students"
  on public.students for insert
  with check (
    public.has_role(auth.uid(), 'admin') or 
    public.has_role(auth.uid(), 'employee')
  );

create policy "Admin and employees can update students"
  on public.students for update
  using (
    public.has_role(auth.uid(), 'admin') or 
    public.has_role(auth.uid(), 'employee')
  );

create policy "Admins can delete students"
  on public.students for delete
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sessions
create policy "Admin and employees can view sessions"
  on public.sessions for select
  using (
    public.has_role(auth.uid(), 'admin') or 
    public.has_role(auth.uid(), 'employee')
  );

create policy "Admin and employees can create sessions"
  on public.sessions for insert
  with check (
    public.has_role(auth.uid(), 'admin') or 
    public.has_role(auth.uid(), 'employee')
  );

create policy "Admin and employees can update sessions"
  on public.sessions for update
  using (
    public.has_role(auth.uid(), 'admin') or 
    public.has_role(auth.uid(), 'employee')
  );

create policy "Admins can delete sessions"
  on public.sessions for delete
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for attendance
create policy "Admin and employees can view attendance"
  on public.attendance for select
  using (
    public.has_role(auth.uid(), 'admin') or 
    public.has_role(auth.uid(), 'employee')
  );

create policy "Admin and employees can mark attendance"
  on public.attendance for insert
  with check (
    public.has_role(auth.uid(), 'admin') or 
    public.has_role(auth.uid(), 'employee')
  );

create policy "Admins can delete attendance"
  on public.attendance for delete
  using (public.has_role(auth.uid(), 'admin'));

-- Trigger function for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for profiles updated_at
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

-- Trigger for auto-creating profile
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();