-- Test project only. English names for the home-radiology services (they were the only services without name_en).
-- The app shows name_en when the language is English. Only fills empty ones; never overwrites a name someone wrote.
update public.sub_services s set name_en = v.en
from (values
  ('أشعة سينية', 'X-Ray'),
  ('أشعة عادية X-Ray ( وضع واحد )', 'Plain X-Ray (single view)'),
  ('تخطيط قلب', 'ECG'),
  ('رسم قلب ECG', 'ECG'),
  ('دوبلر/دوبلكس على الأوردة والشرايين ( طرف واحد )', 'Venous and arterial Doppler/Duplex (one limb)'),
  ('رسم المخ ديجيتال Digital EEG', 'Digital EEG (brain)'),
  ('رسم المخ فيديو Video EEG', 'Video EEG (brain)'),
  ('رسم عصب طرف واحد NCS', 'Nerve conduction study NCS (one limb)'),
  ('رسم عصب وعضلات طرف واحد NCS + EMG', 'Nerve and muscle study NCS + EMG (one limb)'),
  ('موجات صوتية', 'Ultrasound'),
  ('موجات صوتية بطن وحوض (سونار)', 'Abdominal and pelvic ultrasound (sonar)'),
  ('موجات صوتية على القلب (إيكو)', 'Echocardiography (echo)')
) as v(ar, en)
where s.service_name = 'أشعة منزلية'
  and regexp_replace(s.name, '\s+', ' ', 'g') = v.ar
  and (s.name_en is null or s.name_en = '');
