import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    // 2. Check if current user is an admin for the clinic
    const { userId, newPassword, requestId } = await req.json()
    
    // Validate that the target user and the admin are in the same clinic
    const { data: adminProfile } = await supabaseClient
      .from('profiles')
      .select('clinic_id, is_superadmin')
      .eq('user_id', user.id)
      .single()

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('clinic_id')
      .eq('user_id', userId)
      .single()

    if (!adminProfile || !targetProfile) throw new Error('Profile not found')

    const isSameClinic = adminProfile.clinic_id === targetProfile.clinic_id
    const isSuper = adminProfile.is_superadmin

    if (!isSameClinic && !isSuper) {
      throw new Error('You do not have permission to reset this users password')
    }

    // 3. Update password via Admin SDK
    const { error: resetError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (resetError) throw resetError

    // 4. Mark request as approved
    if (requestId) {
      await adminClient
        .from('password_reset_requests')
        .update({ status: 'approved' })
        .eq('id', requestId)
    }

    return new Response(
      JSON.stringify({ message: 'Password updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
