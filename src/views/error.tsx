import { Link } from "react-router"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty"
import { AlertTriangleIcon, HomeIcon, RotateCcwIcon } from "lucide-react"

const ErrorPage = () => {
	const navigate = useNavigate()

	return (
		<div className="flex min-h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_35%),linear-gradient(180deg,transparent,rgba(15,23,42,0.03))] p-6">
			<Card className="w-full max-w-xl shadow-sm">
				<CardHeader>
					<CardTitle>Page unavailable</CardTitle>
					<CardDescription>
						The requested route could not be resolved, or a workspace record is missing.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Empty className="border border-dashed border-border bg-muted/30">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<AlertTriangleIcon />
							</EmptyMedia>
							<EmptyTitle>Something interrupted this view</EmptyTitle>
							<EmptyDescription>
								Retry from the previous route, or return to the dashboard to reopen a valid module item.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent className="flex-row justify-center gap-2">
							<Button variant="outline" onClick={() => navigate(-1)}>
								<RotateCcwIcon />
								Back
							</Button>
							<Button render={<Link to="/dashboard" />}>
								<HomeIcon />
								Dashboard
							</Button>
							<Button variant="outline" onClick={() => window.location.reload()}>
								<RotateCcwIcon />
								Reload
							</Button>
						</EmptyContent>
					</Empty>
				</CardContent>
			</Card>
		</div>
	)
}

export default ErrorPage
