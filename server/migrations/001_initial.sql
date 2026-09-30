create table if not exists stock (
  sku text primary key,
  name text not null,
  shelf_x int not null,
  shelf_y int not null,
  on_hand int not null check (on_hand >= 0),
  reserved int not null default 0 check (reserved >= 0),
  check (reserved <= on_hand)
);
create table if not exists orders (
  id bigint generated always as identity primary key,
  idempotency_key text not null unique,
  status text not null check (status in ('RESERVED','PICKING','PACKED','DISPATCHED')),
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  packed_at timestamptz,
  dispatched_at timestamptz
);
create table if not exists tasks (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  sku text not null references stock(sku),
  qty int not null check (qty > 0),
  priority smallint not null default 0,
  status text not null check (status in ('PENDING','ASSIGNED','PICKED','DONE')),
  robot_id int,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists tasks_queue_idx on tasks (status, priority desc, created_at);
create index if not exists orders_status_idx on orders (status);
