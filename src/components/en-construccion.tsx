import { Hammer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type EnConstruccionProps = {
  fase: number
  /** Lo que se podrá hacer aquí, en frases cortas. */
  podras: string[]
}

/** Aviso amable para las secciones que todavía no están listas. */
export function EnConstruccion({ fase, podras }: EnConstruccionProps) {
  return (
    <Card className='border-dashed'>
      <CardContent className='flex flex-col gap-4 sm:flex-row sm:items-start'>
        <div className='flex size-12 shrink-0 items-center justify-center rounded-full bg-marca-amarillo/25 text-marca-naranja'>
          <Hammer className='size-6' />
        </div>
        <div className='space-y-2'>
          <h2 className='text-lg font-semibold'>
            Esta sección se está construyendo (fase {fase})
          </h2>
          <p className='text-muted-foreground'>Cuando esté lista podrás:</p>
          <ul className='list-disc space-y-1 ps-5'>
            {podras.map((frase) => (
              <li key={frase}>{frase}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
