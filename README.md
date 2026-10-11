# Centralized Campus Food Ordering System

**Lab & Group:** P2 Group-18

## Team Members
* Singireddy Hrushikesh Reddy [2024AAPS0239H]
* Kartikey Gaur [2024AAPS0225H]
* Deeptimahanti Aashrith [2024AAPS0189H]
* Aryaman Ray [2024AAPS0227H]
* Kothapalli Manobhiram Reddy [2024AAPS0240H]

## Project Description
**The Problem:** Campus food courts suffer from long queues, fragmented cash payments, and no centralized way for students to track their spending or daily nutrition.
**The Solution:** We are building a full-stack, cashless application that systematically manages food ordering, financial ledgers, and dietary tracking using a centralized relational database. 

## Application Design
**Proposed Technology Stack:**
* **Frontend:** React + Vite
* **Backend:** Node.js with Express.js
* **Database:** PostgreSQL

**High-Level Architecture:**
The system follows a standard 3-tier decoupled architecture. The React frontend sends user actions to the Node.js backend server, which validates business rules and executes secure SQL operations on the PostgreSQL relational database.

**Core Application Workflows:**
1. **Union Setup and Auditing:** Admins insert new outlets into the system, standardise the master menu catalog, and run system-wide income/expenditure queries.
2. **Student Ordering and Tracking:** Students place cashless orders using a pre-paid semester ledger while viewing dynamically calculated cart totals and nutritional tracking data.
3. **Outlet Fulfilment and Analytics:** Vendors receive real-time orders, toggle inventory availability, trigger ACID transactions upon order acceptance, and access income reporting dashboards.

## Entity-Relationship (ER) Diagram
*Note: The complete, detailed ER diagram mapping all entities, relationships, and weak entity constraints is attached in the uploaded Mid-Semester Project Report PDF.*

## Relational Schema
The database schema has been normalized to the Third Normal Form (3NF) to ensure data integrity and eliminate redundancy. 
*(Note: Primary Keys are **bolded** and marked with **(PK)**. Foreign Keys are italicized and marked with *(FK)*. Attributes that serve as both are bold, italicized, and marked with ***(PK/FK)***).*

* **STUDENT** (**student_id (PK)**, name, email, current_balance)
* **OUTLET** (**outlet_id (PK)**, name)
* **OUTLET_PHONE** (***outlet_id (PK/FK)***, **contact_phone (PK)**)
* **MENU_ITEM** (**item_id (PK)**, *outlet_id (FK)*, name, base_price, category, diet_type, is_available, is_parcelable, parcel_charge, calories, protein)
* **ITEM_EXTRA** (**extra_id (PK)**, *outlet_id (FK)*, name, price)
* **UNION_ADMIN** (**admin_id (PK)**, name, email)
* **ORDER** (***outlet_id (PK/FK)***, **logical_date (PK)**, **daily_token_number (PK)**, *student_id (FK)*, actual_timestamp, status, total_amount)
* **ORDER_ITEM** (***outlet_id (PK/FK)***, ***logical_date (PK/FK)***, ***daily_token_number (PK/FK)***, **item_seq_no (PK)**, *item_id (FK)*, quantity, is_parcel)
* **ORDER_ITEM_EXTRA** (***outlet_id (PK/FK)***, ***logical_date (PK/FK)***, ***daily_token_number (PK/FK)***, ***item_seq_no (PK/FK)***, ***extra_id (PK/FK)***)

### Foreign Key Connections
* `OUTLET_PHONE.outlet_id` -> `OUTLET.outlet_id`
* `MENU_ITEM.outlet_id` -> `OUTLET.outlet_id`
* `ITEM_EXTRA.outlet_id` -> `OUTLET.outlet_id`
* `ORDER.outlet_id` -> `OUTLET.outlet_id`
* `ORDER.student_id` -> `STUDENT.student_id`
* `ORDER_ITEM.(outlet_id, logical_date, daily_token_number)` -> `ORDER.(outlet_id, logical_date, daily_token_number)`
* `ORDER_ITEM.item_id` -> `MENU_ITEM.item_id`
* `ORDER_ITEM_EXTRA.extra_id` -> `ITEM_EXTRA.extra_id`
* `ORDER_ITEM_EXTRA.(outlet_id, logical_date, daily_token_number, item_seq_no)` -> `ORDER_ITEM.(outlet_id, logical_date, daily_token_number, item_seq_no)`

## Current Progress
For the mid-semester submission, the team collaborated to establish the foundational database architecture and system requirements. We defined the core problem statement, finalized the business rules (including logical day boundaries and cashless ledger transaction logic), designed the conceptual ER model, and systematically mapped the relational schema to ensure strict 3NF compliance.
