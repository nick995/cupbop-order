@AGENTS.md

## Customer Login Rule

Customers do not need to create an account or log in.

The ordering flow should be guest checkout only.

Customers only need to provide:

- Customer name
- Phone number
- Email address
- Pickup date
- Pickup time
- Order type
- Payment method
- Special instructions

Admin login is only for the store/admin dashboard.

## Payment Rule

Do not process payment online.

At checkout, ask the customer how they plan to pay:

- Cash at store
- Credit card at store

This field should be saved as `payment_method`.

The website should clearly say:

"Payment will be completed at the store. Your order request will be confirmed by Cupbop Park City."

Do not add Stripe, Square, or any online payment system unless requested later.

## Notification Rule

After a customer submits an order request:

1. Save the order to Supabase.
2. Show the confirmation page to the customer.
3. Send an email notification to the store.

For MVP, use email notification first.

Recommended email tools:

- Resend
- SendGrid
- Supabase Edge Function with email provider

Optional later:

- SMS notification to store phone using Twilio

Do not send SMS to customers unless SMS consent wording is added later.

## Checkout Page Fields

The `/checkout` page should include:

- Customer name
- Customer phone
- Customer email
- Order type:
  - Pickup (pick up at store, no minimum, no delivery address)
  - Catering (delivery only, minimum 15 bowls, delivery address required)
- Pickup / delivery date (label changes based on order type)
- Pickup / delivery time (label changes based on order type)
- Delivery address (Catering only)
- Payment method:
  - Cash at store
  - Credit card at store
- Special instructions
- Submit order request button

## Catering Rules

- Catering orders require a minimum of 15 bowls total (sum of qty across all cart lines).
- Catering orders are delivery only — there is NO pickup option for catering.
- Catering orders require a delivery address.
- Both the client (checkout form) and the server (`/api/orders`) enforce these rules.

## Updated orders Table

The `orders` table should include:

- id
- customer_name
- customer_phone
- customer_email
- order_type
- pickup_date
- pickup_time
- delivery_address (nullable; required only for Catering)
- payment_method
- special_instructions
- status
- subtotal
- items (jsonb)
- created_at
- updated_at

Allowed `payment_method` values:

- Cash
- Credit Card

Default order status:

- New
