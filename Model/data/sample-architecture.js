export const SAMPLE_ARCHITECTURE_DATA = `
# Singtel Architecture Systems

## ECOM Service (E-Commerce Platform)
- **Type**: Microservice
- **Owner**: Team Alpha
- **Description**: Main e-commerce service handling customer orders and product catalog
- **Status**: Active
- **Last Deploy**: 2 hours ago
- **Dependencies**: Kenan Billing API, ESOM Gateway
- **Database**: MongoDB Cluster
- **Technology**: Node.js, Express, React
- **Endpoints**:
  - POST /api/orders - Create new order
  - GET /api/products - Fetch product catalog
  - GET /api/customers - Retrieve customer data

## Kenan Billing API
- **Type**: REST API
- **Owner**: Team Beta
- **Description**: Billing and invoicing system API for Singtel services
- **Status**: Active
- **Last Deploy**: 1 day ago
- **Dependencies**: MongoDB Cluster
- **Technology**: Java Spring Boot
- **Purpose**: Handles billing calculations, invoice generation, payment processing
- **Integration**: Connected to ECOM Service for order billing
- **Database Operations**: Read/Write operations on MongoDB

## ESOM Gateway (Enterprise Service Order Management)
- **Type**: API Gateway / Microservice
- **Owner**: Team Gamma
- **Description**: Service order management and orchestration layer
- **Status**: Warning
- **Last Deploy**: 3 days ago
- **Dependencies**: MongoDB Cluster, Message Queue
- **Technology**: Node.js, Kong Gateway
- **Purpose**: Order orchestration, service provisioning, workflow management
- **Integration**: Receives requests from ECOM Service
- **Messaging**: Publishes events to Message Queue for async processing

## MongoDB Cluster
- **Type**: Database
- **Owner**: DBA Team
- **Description**: Primary NoSQL database cluster for all services
- **Status**: Active
- **Technology**: MongoDB 6.0
- **Replication**: 3-node replica set
- **Connections**: ECOM Service, Kenan Billing API, ESOM Gateway
- **Data**: Customer records, orders, billing information, service configurations

## Message Queue
- **Type**: Queue / Message Broker
- **Owner**: Platform Team
- **Description**: Asynchronous message processing system
- **Status**: Active
- **Technology**: RabbitMQ
- **Purpose**: Event-driven communication between services
- **Publishers**: ESOM Gateway
- **Consumers**: Background workers, notification services

## Architecture Flow:
1. ECOM Service receives customer order
2. ECOM calls Kenan Billing API for billing calculation
3. ECOM sends service request to ESOM Gateway
4. Kenan Billing API persists billing data to MongoDB Cluster
5. ESOM Gateway queries MongoDB for service configuration
6. ESOM Gateway publishes order events to Message Queue
7. Background workers consume messages for order fulfillment

## Component Relationships:
- ECOM Service -> Kenan Billing API: API Call for billing operations
- ECOM Service -> ESOM Gateway: Service provisioning requests
- Kenan Billing API -> MongoDB Cluster: Read/Write billing data
- ESOM Gateway -> MongoDB Cluster: Query service configurations
- ESOM Gateway -> Message Queue: Publish order events

## Common Questions:
- How does order processing work? ECOM receives order, calls Kenan for billing, sends to ESOM for provisioning
- What database is used? MongoDB Cluster is the primary database for all services
- How do services communicate? REST APIs for synchronous calls, Message Queue for async events
- Which team owns what? Team Alpha (ECOM), Team Beta (Kenan), Team Gamma (ESOM), DBA Team (MongoDB), Platform Team (Message Queue)
`;

export default SAMPLE_ARCHITECTURE_DATA;
