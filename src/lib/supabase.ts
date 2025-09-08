import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database connection test function
export async function testDatabaseConnection() {
  try {
    const { data, error } = await supabase.from('accounts').select('count', { count: 'exact', head: true })
    
    if (error) {
      console.error('Database connection test failed:', error)
      return { success: false, error }
    }
    
    console.log('Database connection successful')
    return { success: true, data }
  } catch (err) {
    console.error('Database connection test error:', err)
    return { success: false, error: err }
  }
}