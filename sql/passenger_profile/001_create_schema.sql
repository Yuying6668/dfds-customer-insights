create schema if not exists dfds_profile;

create table if not exists dfds_profile.dim_source_assumption (
  source_assumption_id text primary key,
  source_type text not null,
  source_name text not null,
  source_note text not null,
  confidence_level text not null,
  synthetic_rule_summary text not null
);

create table if not exists dfds_profile.dim_route (
  route_id text primary key,
  route_name text not null,
  origin_port text not null,
  destination_port text not null,
  origin_country text not null,
  destination_country text not null,
  country_pair text not null,
  route_cluster text not null,
  route_type text not null,
  duration_band text not null,
  overnight_flag boolean not null,
  vehicle_friendly_flag boolean not null,
  mini_cruise_relevant_flag boolean not null,
  primary_trip_motivation text not null,
  seasonality_pattern text not null,
  source_assumption_id text not null references dfds_profile.dim_source_assumption(source_assumption_id)
);

create table if not exists dfds_profile.dim_product (
  product_id text primary key,
  product_name text not null,
  product_category text not null,
  cabin_or_seat_type text not null,
  cabin_class text not null,
  meal_package_flag boolean not null,
  onboard_entertainment_flag boolean not null,
  pet_travel_flag boolean not null,
  priority_boarding_flag boolean not null,
  flexible_ticket_flag boolean not null,
  package_type text not null,
  price_band text not null,
  service_intensity text not null,
  source_assumption_id text not null references dfds_profile.dim_source_assumption(source_assumption_id)
);

create table if not exists dfds_profile.dim_booking_channel (
  booking_channel_id text primary key,
  channel_name text not null,
  channel_type text not null,
  device_type text not null,
  campaign_type text not null,
  booking_language text not null,
  source_assumption_id text not null references dfds_profile.dim_source_assumption(source_assumption_id)
);

create table if not exists dfds_profile.dim_travel_context (
  travel_context_id text primary key,
  travel_purpose text not null,
  party_type text not null,
  trip_duration_intent text not null,
  occasion_type text not null,
  car_dependency_level text not null,
  flexibility_need text not null,
  source_assumption_id text not null references dfds_profile.dim_source_assumption(source_assumption_id)
);

create table if not exists dfds_profile.dim_passenger (
  passenger_id text primary key,
  age_group text not null,
  gender text not null,
  nationality text not null,
  residence_country text not null,
  residence_region text not null,
  income_band text not null,
  spending_power_proxy text not null,
  household_type text not null,
  occupation_type text not null,
  language text not null,
  life_stage text not null,
  segment_label text not null,
  preferred_route_cluster text not null,
  preferred_travel_context text not null,
  preferred_product_category text not null,
  repeat_propensity numeric(4,3) not null,
  price_sensitivity_level text not null,
  source_assumption_id text not null references dfds_profile.dim_source_assumption(source_assumption_id)
);

create table if not exists dfds_profile.dim_date (
  date_id integer primary key,
  calendar_date date not null,
  year smallint not null,
  quarter smallint not null,
  month smallint not null,
  month_name text not null,
  week_of_year smallint not null,
  day_of_week text not null,
  season text not null,
  weekend_flag boolean not null,
  holiday_period_flag boolean not null,
  school_holiday_flag boolean not null,
  source_assumption_id text not null references dfds_profile.dim_source_assumption(source_assumption_id)
);

create table if not exists dfds_profile.fact_passenger_trips (
  trip_id text primary key,
  passenger_id text not null references dfds_profile.dim_passenger(passenger_id),
  route_id text not null references dfds_profile.dim_route(route_id),
  date_id integer not null references dfds_profile.dim_date(date_id),
  travel_context_id text not null references dfds_profile.dim_travel_context(travel_context_id),
  product_id text not null references dfds_profile.dim_product(product_id),
  booking_channel_id text not null references dfds_profile.dim_booking_channel(booking_channel_id),
  source_assumption_id text not null references dfds_profile.dim_source_assumption(source_assumption_id),
  trip_sequence integer not null,
  party_size integer not null,
  adult_count integer not null,
  child_count integer not null,
  senior_count integer not null,
  vehicle_included boolean not null,
  vehicle_type text not null,
  booking_lead_days integer not null,
  cabin_booked_flag boolean not null,
  ticket_price numeric(10,2) not null,
  ancillary_spend numeric(10,2) not null,
  total_order_value numeric(10,2) not null,
  discount_used boolean not null,
  repeat_trip_flag boolean not null,
  synthetic_confidence_score numeric(4,3) not null
);

create index if not exists idx_fact_passenger_trips_passenger_id on dfds_profile.fact_passenger_trips(passenger_id);
create index if not exists idx_fact_passenger_trips_route_id on dfds_profile.fact_passenger_trips(route_id);
create index if not exists idx_fact_passenger_trips_date_id on dfds_profile.fact_passenger_trips(date_id);
create index if not exists idx_fact_passenger_trips_travel_context_id on dfds_profile.fact_passenger_trips(travel_context_id);
create index if not exists idx_fact_passenger_trips_product_id on dfds_profile.fact_passenger_trips(product_id);
create index if not exists idx_fact_passenger_trips_booking_channel_id on dfds_profile.fact_passenger_trips(booking_channel_id);
