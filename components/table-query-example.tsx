"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { queryTable, getTableSchema } from "@/actions/database-actions"

export default function TableQueryExample() {
  const [tableName, setTableName] = useState("")
  const [queryResult, setQueryResult] = useState<any>(null)
  const [schema, setSchema] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleQuery = async () => {
    if (!tableName.trim()) return

    setLoading(true)
    try {
      const [dataResult, schemaResult] = await Promise.all([queryTable(tableName, 5), getTableSchema(tableName)])

      setQueryResult(dataResult)
      setSchema(schemaResult)
    } catch (error) {
      console.error("Query failed:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Query Table Example</CardTitle>
        <CardDescription>Enter a table name to see its structure and sample data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Enter table name" value={tableName} onChange={(e) => setTableName(e.target.value)} />
          <Button onClick={handleQuery} disabled={loading || !tableName.trim()}>
            {loading ? "Querying..." : "Query"}
          </Button>
        </div>

        {schema?.success && (
          <div>
            <h4 className="font-semibold mb-2">Table Schema:</h4>
            <div className="bg-gray-50 p-3 rounded text-sm">
              <pre>{JSON.stringify(schema.schema, null, 2)}</pre>
            </div>
          </div>
        )}

        {queryResult?.success && (
          <div>
            <h4 className="font-semibold mb-2">Sample Data ({queryResult.count} rows):</h4>
            <div className="bg-gray-50 p-3 rounded text-sm overflow-auto">
              <pre>{JSON.stringify(queryResult.data, null, 2)}</pre>
            </div>
          </div>
        )}

        {(queryResult?.success === false || schema?.success === false) && (
          <div className="text-red-600 text-sm">Error: {queryResult?.error || schema?.error}</div>
        )}
      </CardContent>
    </Card>
  )
}
