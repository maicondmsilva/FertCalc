-- Allow authenticated RLS policies to evaluate the private ownership helper.
-- The private schema is not exposed through the Data API.

grant execute on function private.can_access_user_data(text) to authenticated;

comment on function private.can_access_user_data(text) is
  'Evaluates record ownership and management hierarchy for authenticated RLS policies; callable only through the non-exposed private schema.';
