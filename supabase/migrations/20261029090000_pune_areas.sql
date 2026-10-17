-- 55 Pune Areas grouped by zone (#142, decision 50). lat/lng are read by the app to suggest the
-- nearest Area on the phone; they are derived from center so they can never drift from it.

alter table public.areas
  add column zone text check (zone in ('west', 'pimpri_chinchwad', 'central', 'east', 'south')),
  add column lat double precision generated always as (extensions.st_y(center::extensions.geometry)) stored,
  add column lng double precision generated always as (extensions.st_x(center::extensions.geometry)) stored;

update public.areas set zone = case when id = 'kharadi' then 'east' else 'west' end;

alter table public.areas alter column zone set not null;

-- Approximate neighbourhood midpoints, close enough for kilometre distance bands.
insert into public.areas (id, name, center, zone) values
  ('pashan', 'Pashan', 'SRID=4326;POINT(73.7930 18.5380)', 'west'),
  ('sus', 'Sus', 'SRID=4326;POINT(73.7550 18.5450)', 'west'),
  ('bavdhan', 'Bavdhan', 'SRID=4326;POINT(73.7790 18.5160)', 'west'),
  ('punawale', 'Punawale', 'SRID=4326;POINT(73.7420 18.6270)', 'west'),
  ('tathawade', 'Tathawade', 'SRID=4326;POINT(73.7490 18.6200)', 'west'),
  ('ravet', 'Ravet', 'SRID=4326;POINT(73.7400 18.6460)', 'west'),
  ('maan', 'Maan / Marunji', 'SRID=4326;POINT(73.7120 18.5980)', 'west'),
  ('pimple-saudagar', 'Pimple Saudagar', 'SRID=4326;POINT(73.8000 18.5980)', 'pimpri_chinchwad'),
  ('pimple-nilakh', 'Pimple Nilakh', 'SRID=4326;POINT(73.8080 18.5800)', 'pimpri_chinchwad'),
  ('pimple-gurav', 'Pimple Gurav', 'SRID=4326;POINT(73.8160 18.5890)', 'pimpri_chinchwad'),
  ('rahatani', 'Rahatani', 'SRID=4326;POINT(73.7880 18.6050)', 'pimpri_chinchwad'),
  ('thergaon', 'Thergaon', 'SRID=4326;POINT(73.7700 18.6080)', 'pimpri_chinchwad'),
  ('chinchwad', 'Chinchwad', 'SRID=4326;POINT(73.7890 18.6280)', 'pimpri_chinchwad'),
  ('pimpri', 'Pimpri', 'SRID=4326;POINT(73.8130 18.6270)', 'pimpri_chinchwad'),
  ('akurdi', 'Akurdi', 'SRID=4326;POINT(73.7680 18.6480)', 'pimpri_chinchwad'),
  ('nigdi', 'Nigdi', 'SRID=4326;POINT(73.7700 18.6540)', 'pimpri_chinchwad'),
  ('bhosari', 'Bhosari', 'SRID=4326;POINT(73.8480 18.6290)', 'pimpri_chinchwad'),
  ('moshi', 'Moshi', 'SRID=4326;POINT(73.8500 18.6700)', 'pimpri_chinchwad'),
  ('dapodi', 'Dapodi', 'SRID=4326;POINT(73.8330 18.5800)', 'pimpri_chinchwad'),
  ('aundh', 'Aundh', 'SRID=4326;POINT(73.8080 18.5580)', 'central'),
  ('shivajinagar', 'Shivajinagar', 'SRID=4326;POINT(73.8470 18.5310)', 'central'),
  ('deccan', 'Deccan Gymkhana', 'SRID=4326;POINT(73.8410 18.5170)', 'central'),
  ('fc-road', 'FC Road', 'SRID=4326;POINT(73.8410 18.5230)', 'central'),
  ('kothrud', 'Kothrud', 'SRID=4326;POINT(73.8080 18.5070)', 'central'),
  ('karve-nagar', 'Karve Nagar', 'SRID=4326;POINT(73.8200 18.4900)', 'central'),
  ('erandwane', 'Erandwane', 'SRID=4326;POINT(73.8300 18.5100)', 'central'),
  ('sadashiv-peth', 'Sadashiv Peth', 'SRID=4326;POINT(73.8500 18.5100)', 'central'),
  ('swargate', 'Swargate', 'SRID=4326;POINT(73.8630 18.5010)', 'central'),
  ('camp', 'Camp', 'SRID=4326;POINT(73.8790 18.5150)', 'central'),
  ('koregaon-park', 'Koregaon Park', 'SRID=4326;POINT(73.8940 18.5360)', 'central'),
  ('yerawada', 'Yerawada', 'SRID=4326;POINT(73.8900 18.5530)', 'central'),
  ('viman-nagar', 'Viman Nagar', 'SRID=4326;POINT(73.9140 18.5670)', 'east'),
  ('kalyani-nagar', 'Kalyani Nagar', 'SRID=4326;POINT(73.9020 18.5480)', 'east'),
  ('wagholi', 'Wagholi', 'SRID=4326;POINT(73.9850 18.5800)', 'east'),
  ('hadapsar', 'Hadapsar', 'SRID=4326;POINT(73.9270 18.5020)', 'east'),
  ('magarpatta', 'Magarpatta', 'SRID=4326;POINT(73.9300 18.5150)', 'east'),
  ('mundhwa', 'Mundhwa', 'SRID=4326;POINT(73.9300 18.5330)', 'east'),
  ('wanowrie', 'Wanowrie', 'SRID=4326;POINT(73.8970 18.4900)', 'east'),
  ('kondhwa', 'Kondhwa', 'SRID=4326;POINT(73.8900 18.4650)', 'east'),
  ('dhanori', 'Dhanori', 'SRID=4326;POINT(73.9050 18.5930)', 'east'),
  ('vishrantwadi', 'Vishrantwadi', 'SRID=4326;POINT(73.8800 18.5720)', 'east'),
  ('katraj', 'Katraj', 'SRID=4326;POINT(73.8600 18.4500)', 'south'),
  ('bibwewadi', 'Bibwewadi', 'SRID=4326;POINT(73.8640 18.4710)', 'south'),
  ('dhankawadi', 'Dhankawadi', 'SRID=4326;POINT(73.8500 18.4600)', 'south'),
  ('sinhagad-road', 'Sinhagad Road', 'SRID=4326;POINT(73.8150 18.4700)', 'south'),
  ('warje', 'Warje', 'SRID=4326;POINT(73.8000 18.4840)', 'south'),
  ('undri', 'Undri', 'SRID=4326;POINT(73.9150 18.4550)', 'south'),
  ('nibm', 'NIBM Road', 'SRID=4326;POINT(73.9000 18.4700)', 'south'),
  ('ambegaon', 'Ambegaon', 'SRID=4326;POINT(73.8400 18.4450)', 'south'),
  ('narhe', 'Narhe', 'SRID=4326;POINT(73.8250 18.4500)', 'south');
