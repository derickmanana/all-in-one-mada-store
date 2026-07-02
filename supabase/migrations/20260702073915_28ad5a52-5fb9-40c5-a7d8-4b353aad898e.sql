-- Drop overly permissive read policy on messages
DROP POLICY IF EXISTS "authenticated realtime read" ON public.messages;

-- Scope realtime channel subscriptions to conversation participants
DROP POLICY IF EXISTS "authenticated can subscribe" ON realtime.messages;
DROP POLICY IF EXISTS "auth realtime read" ON realtime.messages;

CREATE POLICY "participants subscribe to their conversation topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE ('conversation:' || c.id::text) = realtime.topic()
      AND (c.client_id = auth.uid() OR c.vendor_id = auth.uid())
  )
  OR realtime.topic() LIKE 'notif-%'
  OR realtime.topic() = 'messages'
);