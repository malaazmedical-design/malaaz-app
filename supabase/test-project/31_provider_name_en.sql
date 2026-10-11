-- Test project only. English names for providers (personal names + diagnostic centres).
-- The app shows name_en when the language is English. If it is empty, the app transliterates the Arabic name automatically.
-- A provider can write their own English name from "تعديل الحساب"; the admin can fix it from the admin panel.
alter table public.providers add column if not exists name_en text;

-- Names already in the demo data (only fills empty ones; never overwrites a name someone wrote)
update public.providers p set name_en = v.en
from (values
  ('آية محسن','Aya Mohsen'),
  ('أحمد سمير','Ahmed Samir'),
  ('أسماء بدر','Asmaa Badr'),
  ('أمير زكي','Amir Zaki'),
  ('أميرة سالم','Amira Salem'),
  ('أيمن شوقي','Ayman Shawky'),
  ('إسلام ماهر','Islam Maher'),
  ('إيمان رأفت','Eman Raafat'),
  ('إيمان زكريا','Eman Zakaria'),
  ('باسم عوض','Basem Awad'),
  ('بسام وحيد','Bassam Waheed'),
  ('تامر عزت','Tamer Ezzat'),
  ('جيهان فهمي','Gehan Fahmy'),
  ('حازم سامي','Hazem Sami'),
  ('حسام الدين فتحي','Hossam El Din Fathy'),
  ('خالد جمال','Khaled Gamal'),
  ('داليا فتحي','Dalia Fathy'),
  ('دينا شريف','Dina Sherif'),
  ('رامي كمال','Ramy Kamal'),
  ('ربيع جاد','Rabie Gad'),
  ('رحاب مراد','Rehab Mourad'),
  ('رشا عطية','Rasha Attia'),
  ('رنا وجدي','Rana Wagdy'),
  ('ريم صبري','Reem Sabry'),
  ('سارة عماد','Sara Emad'),
  ('سارة محمود','Sara Mahmoud'),
  ('سحر عباس','Sahar Abbas'),
  ('سلمى عادل','Salma Adel'),
  ('سماح حجازي','Samah Hegazy'),
  ('سمر هلال','Samar Helal'),
  ('شادي لطفي','Shady Lotfy'),
  ('شيماء حلمي','Shaimaa Helmy'),
  ('طارق فؤاد','Tarek Fouad'),
  ('عادل قنديل','Adel Kandil'),
  ('عبير سليم','Abeer Selim'),
  ('عصام توفيق','Essam Tawfik'),
  ('علاء الشافعي','Alaa El Shafei'),
  ('عماد رشدي','Emad Roshdy'),
  ('عمر خالد','Omar Khaled'),
  ('غادة نصر','Ghada Nasr'),
  ('فادي سعد','Fady Saad'),
  ('كريم حسن','Karim Hassan'),
  ('ليلى حسام','Layla Hossam'),
  ('ماجد عصام','Maged Essam'),
  ('محسن رفعت','Mohsen Refaat'),
  ('محمد عوض','Mohamed Awad'),
  ('محمود عادل','Mahmoud Adel'),
  ('مروة يحيى','Marwa Yehia'),
  ('مصطفى نبيل','Mostafa Nabil'),
  ('منال بدوي','Manal Badawy'),
  ('منى إبراهيم','Mona Ibrahim'),
  ('مي أشرف','Mai Ashraf'),
  ('نادية فاروق','Nadia Farouk'),
  ('نجلاء فهيم','Naglaa Fahim'),
  ('نهى عبد الله','Noha Abdel Allah'),
  ('نورهان طه','Nourhan Taha'),
  ('هالة مصطفى','Hala Mostafa'),
  ('هبة سعيد','Heba Said'),
  ('هدى عبد الرحمن','Hoda Abdel Rahman'),
  ('هشام رضا','Hesham Reda'),
  ('هناء مرسي','Hana Morsy'),
  ('وائل صلاح','Wael Salah'),
  ('ولاء ناجي','Walaa Nagy'),
  ('ياسر منصور','Yasser Mansour'),
  ('يوسف مجدي','Youssef Magdy'),
  ('مركز الأمل التشخيصي','Al Amal Diagnostic Center'),
  ('مركز الأهرام للأشعة','Al Ahram Radiology Center'),
  ('مركز البرج التشخيصي','Al Borg Diagnostic Center'),
  ('مركز الحياة للأشعة','Al Hayah Radiology Center'),
  ('مركز الرحمة','Al Rahma Center'),
  ('مركز السلام','Al Salam Center'),
  ('مركز الشفاء','Al Shifa Center'),
  ('مركز الصفوة','Al Safwa Center'),
  ('مركز الفجر للأشعة','Al Fagr Radiology Center'),
  ('مركز المدينة','Al Madina Center'),
  ('مركز المستقبل','Al Mostaqbal Center'),
  ('مركز النور للأشعة','Al Nour Radiology Center'),
  ('مركز النيل التشخيصي','Al Nile Diagnostic Center'),
  ('مركز الواحة','Al Waha Center'),
  ('مركز دلتا للأشعة','Delta Radiology Center')
) as v(ar, en)
where p.name = v.ar and (p.name_en is null or p.name_en = '');

-- Admin sets / clears the English name of any provider
create or replace function public.admin_set_provider_name_en(p_id uuid, p_name_en text)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then return 'forbidden'; end if;
  update public.providers set name_en = nullif(btrim(p_name_en), '') where id = p_id;
  if not found then return 'not_found'; end if;
  return 'ok';
end; $$;
revoke all on function public.admin_set_provider_name_en(uuid, text) from public, anon;
grant execute on function public.admin_set_provider_name_en(uuid, text) to authenticated;
