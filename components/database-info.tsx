"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Database, Table, CheckCircle, XCircle } from "lucide-react"

interface DatabaseInfoProps {
  tables: string[]
  isConnected: boolean
}

export default function DatabaseInfo({ tables, isConnected }: DatabaseInfoProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Neon Database Connection
          </CardTitle>
          <CardDescription>Connection status and available tables</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            {isConnected ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-green-700">Connected successfully</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-700">Connection failed</span>
              </>
            )}
          </div>

          {tables.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Table className="w-4 h-4" />
                Available Tables ({tables.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {tables.map((table) => (
                  <Badge key={table} variant="secondary">
                    {table}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
