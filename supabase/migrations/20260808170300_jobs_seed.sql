-- Nexora Jobs: deterministic skill taxonomy seed

begin;

insert into public.job_skills(name,slug,category)
values
  ('Hair Cutting','hair-cutting','Hair'),
  ('Hair Styling','hair-styling','Hair'),
  ('Hair Coloring','hair-coloring','Hair'),
  ('Balayage','balayage','Hair'),
  ('Hair Extensions','hair-extensions','Hair'),
  ('Bridal Makeup','bridal-makeup','Makeup'),
  ('Party Makeup','party-makeup','Makeup'),
  ('Airbrush Makeup','airbrush-makeup','Makeup'),
  ('Nail Art','nail-art','Nails'),
  ('Manicure','manicure','Nails'),
  ('Pedicure','pedicure','Nails'),
  ('Gel Extensions','gel-extensions','Nails'),
  ('Facial','facial','Skincare'),
  ('HydraFacial','hydrafacial','Skincare'),
  ('Waxing','waxing','Skincare'),
  ('Threading','threading','Skincare'),
  ('Skin Treatment','skin-treatment','Skincare'),
  ('Lash Extensions','lash-extensions','Lashes & Brows'),
  ('Brow Lamination','brow-lamination','Lashes & Brows'),
  ('Massage Therapy','massage-therapy','Massage'),
  ('Aromatherapy','aromatherapy','Massage'),
  ('Customer Service','customer-service','Operations'),
  ('Salon Management','salon-management','Management'),
  ('Billing','billing','Operations'),
  ('Sales','sales','Operations'),
  ('Inventory Management','inventory-management','Operations'),
  ('Team Leadership','team-leadership','Management'),
  ('Social Media Marketing','social-media-marketing','Marketing')
on conflict do nothing;

commit;
