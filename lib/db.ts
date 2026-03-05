import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

let _sql: NeonQueryFunction<false, false> | null = null

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required")
    }
    _sql = neon(process.env.DATABASE_URL)
  }
  return _sql
}

// Create a lazy SQL client that initializes on first use
export const sql = new Proxy((() => {}) as any, {
  apply(_target: any, _thisArg: any, args: any[]) {
    return (getSql() as any)(...args)
  },
  get(_target: any, prop: string) {
    return (getSql() as any)[prop]
  },
}) as NeonQueryFunction<false, false>

// Example function to test the connection
export async function testConnection() {
  try {
    const result = await sql`SELECT version()`
    // Connection successful
    return true
  } catch (error) {
    console.error("Database connection failed:", error)
    return false
  }
}

// Function to get all tables in the database
export async function getTables() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    return tables.map((table) => table.table_name)
  } catch (error) {
    console.error("Error fetching tables:", error)
    throw error
  }
}
