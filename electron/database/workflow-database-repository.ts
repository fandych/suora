import { getWorkflowDefinitionRowsWithDrizzle, listWorkflowDefinitionsWithDrizzle, createWorkflowDefinitionWithDrizzle, saveWorkflowDefinitionWithDrizzle, deleteWorkflowDefinitionWithDrizzle } from "@electron/database/drizzle/workflow-repository"
import { recordWorkflowInvocation } from "@electron/database/workflow-invocation-database"

export const listWorkflowRows = listWorkflowDefinitionsWithDrizzle
export const getWorkflowRows = getWorkflowDefinitionRowsWithDrizzle
export const createWorkflowRows = createWorkflowDefinitionWithDrizzle
export const saveWorkflowRows = saveWorkflowDefinitionWithDrizzle
export const deleteWorkflowRows = deleteWorkflowDefinitionWithDrizzle
export const recordWorkflowInvocationRow = recordWorkflowInvocation
