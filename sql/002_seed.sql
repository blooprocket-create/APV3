WITH inserted_users AS (
  INSERT INTO users (email, password_hash, name, role)
  VALUES
    ('admin@example.com', crypt('Admin123!', gen_salt('bf', 10)), 'Admin User', 'admin'),
    ('editor@example.com', crypt('Editor123!', gen_salt('bf', 10)), 'Editor User', 'editor'),
    ('customer1@example.com', crypt('Customer123!', gen_salt('bf', 10)), 'Customer One', 'customer'),
    ('customer2@example.com', crypt('Customer123!', gen_salt('bf', 10)), 'Customer Two', 'customer')
  RETURNING id, email, role
), inserted_products AS (
  INSERT INTO products (slug, title, description, price_cents, sku, tags, cover_image_url, digital_file_url)
  VALUES
    ('brand-style-guide', 'Brand Style Guide Template', 'Editable template to craft your brand guidelines.', 4900, 'BRND-001', ARRAY['branding','template'], 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f', 'https://example.com/downloads/brand-style-guide.pdf'),
    ('website-copy-pack', 'Website Copy Pack', 'Polished copy blocks for high converting landing pages.', 3900, 'COPY-001', ARRAY['copywriting','landing-page'], 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f', 'https://example.com/downloads/website-copy-pack.zip'),
    ('social-ads-kit', 'Social Ads Kit', 'Plug-and-play ad creatives optimized for paid campaigns.', 2900, 'SOC-AD-001', ARRAY['ads','social'], 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef', 'https://example.com/downloads/social-ads-kit.zip'),
    ('email-sequence', 'Email Sequence Blueprint', 'Lifecycle email flow with tested subject lines.', 3500, 'EMAIL-001', ARRAY['email','automation'], 'https://images.unsplash.com/photo-1517433456452-f9633a875f6f', 'https://example.com/downloads/email-sequence.pdf'),
    ('pitch-deck-design', 'Pitch Deck Design Pack', 'Beautiful deck layouts and slides for startups.', 5900, 'PITCH-001', ARRAY['presentation','startup'], 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab', 'https://example.com/downloads/pitch-deck-design.zip'),
    ('founder-finance-sheet', 'Founder Finance Sheet', 'Financial planning spreadsheet tailored for solopreneurs.', 4500, 'FIN-001', ARRAY['finance','spreadsheet'], 'https://images.unsplash.com/photo-1454165205744-3b78555e5572', 'https://example.com/downloads/founder-finance-sheet.xlsx')
  RETURNING id, slug
), inserted_services AS (
  INSERT INTO services (slug, title, description, base_price_cents, tags)
  VALUES
    ('launch-strategy', 'Launch Strategy Intensive', 'Collaborative planning sprint to map a go-to-market launch.', 15000, ARRAY['strategy','launch']),
    ('conversion-copy', 'Conversion Copywriting Service', 'Done-for-you conversion copy for pages and funnels.', 18000, ARRAY['copywriting','conversion']),
    ('brand-refresh', 'Brand Refresh Package', 'Updated visual identity, messaging, and collateral.', 24000, ARRAY['branding','design']),
    ('coaching-1-1', '1:1 Founder Coaching', 'Weekly video sessions focused on growth and accountability.', 12000, ARRAY['coaching','mentorship'])
  RETURNING id, slug
), req_data AS (
  SELECT
    (SELECT id FROM inserted_users WHERE email = 'customer1@example.com') AS customer1,
    (SELECT id FROM inserted_users WHERE email = 'customer2@example.com') AS customer2,
    (SELECT id FROM inserted_users WHERE email = 'admin@example.com') AS admin_id,
    (SELECT id FROM inserted_users WHERE email = 'editor@example.com') AS editor_id,
    (SELECT id FROM inserted_services WHERE slug = 'conversion-copy') AS conversion_service,
    (SELECT id FROM inserted_services WHERE slug = 'brand-refresh') AS brand_service
), inserted_requests AS (
  INSERT INTO service_requests (user_id, service_id, status, brief)
  SELECT customer1, conversion_service, 'quoted'::service_request_status, '{"goals": "Refresh landing page copy", "audience": "B2B SaaS"}'::jsonb FROM req_data
  UNION ALL
  SELECT customer2, brand_service, 'in_progress'::service_request_status, '{"goals": "Modernize brand palette", "deliverables": "Logo update"}'::jsonb FROM req_data
  RETURNING id, user_id, service_id, status, created_at
), inserted_messages AS (
  INSERT INTO messages (service_request_id, sender_user_id, body)
  VALUES
    ((SELECT id FROM inserted_requests ORDER BY created_at ASC LIMIT 1), (SELECT admin_id FROM req_data), 'Thanks for the detailed brief! We will create a proposal shortly.'),
    ((SELECT id FROM inserted_requests ORDER BY created_at ASC LIMIT 1), (SELECT user_id FROM inserted_requests ORDER BY created_at ASC LIMIT 1), 'Sounds great, looking forward to the quote.'),
    ((SELECT id FROM inserted_requests ORDER BY created_at DESC LIMIT 1), (SELECT editor_id FROM req_data), 'We have started outlining the new visual directions.')
  RETURNING id, service_request_id
), inserted_quote AS (
  INSERT INTO quotes (service_request_id, amount_cents, notes, status)
  SELECT (SELECT id FROM inserted_requests ORDER BY created_at ASC LIMIT 1), 21000, 'Includes CRO research and 5 landing sections.', 'sent'::quote_status
  RETURNING id
)
INSERT INTO notifications (user_id, type, title, body, meta)
SELECT
  customer1,
  'quote',
  'New Quote Ready',
  'Your request now has a quote awaiting review.',
  jsonb_build_object('quoteId', (SELECT id FROM inserted_quote))
FROM req_data;

-- Seed a paid digital order for customer1
WITH u AS (
  SELECT id AS user_id FROM users WHERE email = 'customer1@example.com'
), prod AS (
  SELECT id, title, price_cents FROM products WHERE slug = 'brand-style-guide'
), inserted_order AS (
  INSERT INTO orders (user_id, status, total_cents, type)
  SELECT user_id, 'paid'::order_status, price_cents, 'digital'::order_type FROM u, prod LIMIT 1
  RETURNING id, user_id
)
INSERT INTO order_items (order_id, product_id, title, unit_price_cents, quantity, subtotal_cents)
SELECT inserted_order.id, prod.id, prod.title, prod.price_cents, 1, prod.price_cents
FROM inserted_order, prod;
