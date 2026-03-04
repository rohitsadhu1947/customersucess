"use server"

import { sql, testConnection, getTables } from "@/lib/db"

export async function getDatabaseInfo() {
  try {
    const isConnected = await testConnection()
    const tables = isConnected ? await getTables() : []

    return {
      success: true,
      isConnected,
      tables,
    }
  } catch (error) {
    console.error("Error getting database info:", error)
    return {
      success: false,
      isConnected: false,
      tables: [],
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Example function to query a specific table
export async function queryTable(tableName: string, limit = 10) {
  try {
    // Note: In production, you should validate tableName to prevent SQL injection
    const validTableName = tableName.replace(/[^a-zA-Z0-9_]/g, "")

    const result = await sql`
      SELECT * FROM ${sql(validTableName)} 
      LIMIT ${limit}
    `

    return {
      success: true,
      data: result,
      count: result.length,
    }
  } catch (error) {
    console.error(`Error querying table ${tableName}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: [],
      count: 0,
    }
  }
}

// Example function to get table schema
export async function getTableSchema(tableName: string) {
  try {
    const schema = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = ${tableName}
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `

    return {
      success: true,
      schema,
    }
  } catch (error) {
    console.error(`Error getting schema for table ${tableName}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      schema: [],
    }
  }
}
