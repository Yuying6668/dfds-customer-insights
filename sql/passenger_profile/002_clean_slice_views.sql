create schema if not exists dfds_profile;

create or replace view dfds_profile.v_clean_passenger_trips as
select
  f.trip_id,
  f.passenger_id,
  p.segment_label,
  p.age_group,
  p.gender,
  p.nationality,
  p.residence_country,
  p.income_band,
  p.spending_power_proxy,
  p.household_type,
  p.life_stage,
  p.price_sensitivity_level,
  r.route_name,
  r.route_cluster,
  r.route_type,
  r.country_pair,
  r.duration_band,
  r.overnight_flag,
  r.vehicle_friendly_flag,
  r.mini_cruise_relevant_flag,
  d.calendar_date,
  d.year,
  d.quarter,
  d.month,
  d.season,
  d.weekend_flag,
  d.holiday_period_flag,
  c.travel_purpose,
  c.party_type,
  c.trip_duration_intent,
  pr.product_name,
  pr.product_category,
  pr.cabin_or_seat_type,
  pr.price_band,
  ch.channel_name,
  ch.channel_type,
  f.party_size,
  f.vehicle_included,
  f.vehicle_type,
  f.booking_lead_days,
  f.cabin_booked_flag,
  f.ticket_price,
  f.ancillary_spend,
  f.total_order_value,
  f.discount_used,
  f.repeat_trip_flag,
  f.synthetic_confidence_score
from dfds_profile.fact_passenger_trips f
join dfds_profile.dim_passenger p on p.passenger_id = f.passenger_id
join dfds_profile.dim_route r on r.route_id = f.route_id
join dfds_profile.dim_date d on d.date_id = f.date_id
join dfds_profile.dim_travel_context c on c.travel_context_id = f.travel_context_id
join dfds_profile.dim_product pr on pr.product_id = f.product_id
join dfds_profile.dim_booking_channel ch on ch.booking_channel_id = f.booking_channel_id
where f.total_order_value >= 0
  and f.party_size between 1 and 8
  and f.synthetic_confidence_score >= 0.60;

create or replace view dfds_profile.v_profile_segment_route_slice as
select
  segment_label,
  route_cluster,
  route_name,
  count(*) as trip_count,
  count(distinct passenger_id) as passenger_count,
  round(avg(total_order_value), 2) as avg_order_value,
  round(avg(ancillary_spend), 2) as avg_ancillary_spend,
  round(avg(case when vehicle_included then 1 else 0 end) * 100, 1) as vehicle_share_pct,
  round(avg(case when cabin_booked_flag then 1 else 0 end) * 100, 1) as cabin_share_pct,
  round(avg(case when repeat_trip_flag then 1 else 0 end) * 100, 1) as repeat_trip_share_pct,
  round(avg(synthetic_confidence_score), 3) as avg_synthetic_confidence
from dfds_profile.v_clean_passenger_trips
group by segment_label, route_cluster, route_name;

create or replace view dfds_profile.v_profile_age_route_slice as
select
  age_group,
  route_cluster,
  route_name,
  count(*) as trip_count,
  round(count(*) * 100.0 / nullif(sum(count(*)) over (partition by age_group), 0), 1) as share_within_age_pct,
  round(avg(total_order_value), 2) as avg_order_value
from dfds_profile.v_clean_passenger_trips
group by age_group, route_cluster, route_name;

create or replace view dfds_profile.v_profile_product_slice as
select
  segment_label,
  product_category,
  product_name,
  count(*) as trip_count,
  round(avg(total_order_value), 2) as avg_order_value,
  round(avg(ancillary_spend), 2) as avg_ancillary_spend,
  round(avg(case when discount_used then 1 else 0 end) * 100, 1) as discount_share_pct
from dfds_profile.v_clean_passenger_trips
group by segment_label, product_category, product_name;

create or replace view dfds_profile.v_profile_context_slice as
select
  route_cluster,
  travel_purpose,
  party_type,
  count(*) as trip_count,
  round(avg(party_size), 2) as avg_party_size,
  round(avg(booking_lead_days), 1) as avg_booking_lead_days,
  round(avg(total_order_value), 2) as avg_order_value
from dfds_profile.v_clean_passenger_trips
group by route_cluster, travel_purpose, party_type;

create or replace view dfds_profile.v_profile_actar_slice as
select
  route_cluster as action_area,
  segment_label as customer_target,
  'Route affinity and product fit'::text as trigger_signal,
  concat(
    segment_label,
    ' account for ',
    trip_count,
    ' synthetic trips on ',
    route_name,
    ', with avg order value ',
    avg_order_value,
    ' and vehicle share ',
    vehicle_share_pct,
    '%.'
  ) as analysis,
  case
    when avg_order_value >= 300 then 'Prioritize premium cabin, mini-cruise, lounge, and comfort messaging.'
    when vehicle_share_pct >= 75 then 'Prioritize vehicle-first booking, parking, boarding, and family packing guidance.'
    when cabin_share_pct >= 60 then 'Prioritize cabin clarity, onboard experience, and overnight comfort content.'
    else 'Prioritize price clarity, flexible ticketing, and short-break conversion messaging.'
  end as recommendation,
  concat('synthetic_profile_confidence=', avg_synthetic_confidence) as confidence_note,
  trip_count,
  passenger_count,
  avg_order_value,
  vehicle_share_pct,
  cabin_share_pct,
  repeat_trip_share_pct
from dfds_profile.v_profile_segment_route_slice
where trip_count >= 10;
