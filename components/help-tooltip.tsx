"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { HelpCircle } from "lucide-react"

interface HelpTooltipProps {
  title: string
  content: React.ReactNode
  trigger?: React.ReactNode
  className?: string
}

export default function HelpTooltip({ title, content, trigger, className }: HelpTooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 ${className}`}
            title="Ayuda"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-500" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  )
} 