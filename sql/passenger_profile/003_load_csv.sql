begin;
set search_path to dfds_profile;
truncate table
  dfds_profile.fact_passenger_trips,
  dfds_profile.dim_passenger,
  dfds_profile.dim_date,
  dfds_profile.dim_travel_context,
  dfds_profile.dim_booking_channel,
  dfds_profile.dim_product,
  dfds_profile.dim_route,
  dfds_profile.dim_source_assumption
restart identity cascade;
\copy dfds_profile.dim_source_assumption from 'data/passenger_profile/dim_source_assumption.csv' with (format csv, header true, encoding 'UTF8');
\copy dfds_profile.dim_route from 'data/passenger_profile/dim_route.csv' with (format csv, header true, encoding 'UTF8');
\copy dfds_profile.dim_product from 'data/passenger_profile/dim_product.csv' with (format csv, header true, encoding 'UTF8');
\copy dfds_profile.dim_booking_channel from 'data/passenger_profile/dim_booking_channel.csv' with (format csv, header true, encoding 'UTF8');
\copy dfds_profile.dim_travel_context from 'data/passenger_profile/dim_travel_context.csv' with (format csv, header true, encoding 'UTF8');
\copy dfds_profile.dim_passenger from 'data/passenger_profile/dim_passenger.csv' with (format csv, header true, encoding 'UTF8');
\copy dfds_profile.dim_date from 'data/passenger_profile/dim_date.csv' with (format csv, header true, encoding 'UTF8');
\copy dfds_profile.fact_passenger_trips from 'data/passenger_profile/fact_passenger_trips.csv' with (format csv, header true, encoding 'UTF8');
commit;
