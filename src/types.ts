export type DietType = 'Veg' | 'Non-Veg';

export type OrderStatus = 'Pending' | 'Accepted' | 'Ready' | 'Rejected' | 'Cancelled';

export type UserRole = 'student' | 'outlet' | 'admin';

export interface AuthUser {
  role: UserRole;
  id: string;
  name: string;
  email: string;
  student_id?: string;
  outlet_id?: number;
  admin_id?: string;
}

export interface Student {
  student_id: string;
  name: string;
  email: string;
  current_balance: number;
}

export interface Outlet {
  outlet_id: number;
  name: string;
  phones: string[];
}

export interface MenuItem {
  item_id: number;
  outlet_id: number;
  outlet_name?: string;
  name: string;
  base_price: number;
  category: string;
  diet_type: DietType;
  is_available: number; // 1 or 0
  is_parcelable: number; // 1 or 0
  parcel_charge: number;
  calories: number;
  protein: number;
  fat: number;
}

export interface ItemExtra {
  extra_id: number;
  outlet_id: number;
  name: string;
  price: number;
}

export interface UnionAdmin {
  admin_id: string;
  name: string;
  email: string;
}

export interface OrderItemDetail {
  item_seq_no: number;
  item_id: number;
  item_name: string;
  category: string;
  diet_type: DietType;
  quantity: number;
  is_parcel: number;
  unit_base_price: number;
  unit_parcel_charge: number;
  calories: number;
  protein: number;
  fat: number;
  extras: {
    extra_id: number;
    name: string;
    price: number;
  }[];
}

export interface OrderRecord {
  outlet_id: number;
  outlet_name: string;
  logical_date: string;
  daily_token_number: number;
  student_id: string;
  student_name: string;
  actual_timestamp: string;
  status: OrderStatus;
  total_amount: number;
  items: OrderItemDetail[];
}

export interface StudentNutritionSummary {
  period: 'day' | 'week' | 'month';
  order_count: number;
  total_spent: number;
  total_calories: number;
  total_protein: number;
  total_fat: number;
}

export interface OutletAnalytics {
  summary: {
    today_revenue: number;
    today_orders: number;
    week_revenue: number;
    week_orders: number;
    month_revenue: number;
    month_orders: number;
  };
  dailyTrend: {
    logical_date: string;
    orders_count: number;
    revenue: number;
  }[];
  byCategory: {
    category: string;
    units_sold: number;
    revenue: number;
  }[];
  byItem: {
    item_id: number;
    name: string;
    category: string;
    diet_type: DietType;
    units_sold: number;
    revenue: number;
  }[];
}

export interface UnionAuditData {
  studentExpenditure: {
    student_id: string;
    name: string;
    email: string;
    current_balance: number;
    initial_deposit: number;
    total_orders: number;
    completed_expenditure: number;
  }[];
  outletRevenue: {
    outlet_id: number;
    name: string;
    phones: string;
    menu_item_count: number;
    total_orders: number;
    accepted_orders: number;
    total_revenue: number;
  }[];
}

export interface DbmsOverviewData {
  tableCounts: { table_name: string; row_count: number }[];
  totalRecords: number;
  logicalDate: string;
  queries: {
    key: string;
    title: string;
    concepts: string;
    sourceRef: string;
    sql: string;
  }[];
}
