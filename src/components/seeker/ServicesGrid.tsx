import React from 'react';
import {
  Scissors,
  User,
  Users,
  Store,
  Sparkles,
  Hand,
  Droplets,
  Smile,
  Palette,
  HeartHandshake,
  Paintbrush,
  Crown,
} from 'lucide-react';

export interface ServiceCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  gradient: string;
  description: string;
  count?: string;
}

const services: ServiceCard[] = [
  {
    id: 'hair-cut',
    title: 'Hair Cut',
    icon: <Scissors className="w-6 h-6" />,
    gradient: 'from-violet-500 to-purple-600',
    description: 'Trendy cuts & styling',
    count: '1.2k+ Jobs',
  },
  {
    id: 'barber',
    title: 'Barber',
    icon: <User className="w-6 h-6" />,
    gradient: 'from-blue-500 to-indigo-600',
    description: 'Fades & beard art',
    count: '850+ Jobs',
  },
  {
    id: 'unisex',
    title: 'Unisex',
    icon: <Users className="w-6 h-6" />,
    gradient: 'from-fuchsia-500 to-pink-600',
    description: 'All gender styling',
    count: '950+ Jobs',
  },
  {
    id: 'salon',
    title: 'Salon',
    icon: <Store className="w-6 h-6" />,
    gradient: 'from-emerald-500 to-teal-600',
    description: 'Premium salon chains',
    count: '2k+ Jobs',
  },
  {
    id: 'beauty',
    title: 'Beauty',
    icon: <Sparkles className="w-6 h-6" />,
    gradient: 'from-amber-500 to-orange-600',
    description: 'Beauty experts',
    count: '1.5k+ Jobs',
  },
  {
    id: 'nail-studio',
    title: 'Nail Studio',
    icon: <Hand className="w-6 h-6" />,
    gradient: 'from-rose-500 to-pink-600',
    description: 'Nail art & extensions',
    count: '600+ Jobs',
  },
  {
    id: 'hair-spa',
    title: 'Hair Spa',
    icon: <Droplets className="w-6 h-6" />,
    gradient: 'from-cyan-500 to-blue-600',
    description: 'Spa & treatments',
    count: '700+ Jobs',
  },
  {
    id: 'facial',
    title: 'Facial',
    icon: <Smile className="w-6 h-6" />,
    gradient: 'from-green-500 to-emerald-600',
    description: 'Skincare specialists',
    count: '800+ Jobs',
  },
  {
    id: 'makeup',
    title: 'Makeup',
    icon: <Palette className="w-6 h-6" />,
    gradient: 'from-pink-500 to-rose-600',
    description: 'Pro MUA artists',
    count: '1k+ Jobs',
  },
  {
    id: 'massage',
    title: 'Massage',
    icon: <HeartHandshake className="w-6 h-6" />,
    gradient: 'from-indigo-500 to-violet-600',
    description: 'Therapy & wellness',
    count: '550+ Jobs',
  },
  {
    id: 'hair-coloring',
    title: 'Hair Coloring',
    icon: <Paintbrush className="w-6 h-6" />,
    gradient: 'from-orange-500 to-red-600',
    description: 'Color & balayage',
    count: '900+ Jobs',
  },
  {
    id: 'bridal-makeup',
    title: 'Bridal Makeup',
    icon: <Crown className="w-6 h-6" />,
    gradient: 'from-yellow-500 to-amber-600',
    description: 'Bridal specialists',
    count: '400+ Jobs',
  },
];

interface ServicesGridProps {
  onSelectService?: (serviceTitle: string) => void;
}

export const ServicesGrid: React.FC<ServicesGridProps> = ({ onSelectService }) => {
  return (
    <div className="bg-white rounded-2xl border border-[#cbd5e1]/50 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0f172a]">Explore Services</h2>
            <p className="text-[11px] text-[#64748b]">12 premium beauty categories</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#ede9fe] text-[#4f46e5]">
          12 Cards
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => onSelectService?.(service.title)}
            className="group relative overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white hover:border-[#c4b5fd] hover:shadow-md transition-all duration-300 text-left p-3.5 flex flex-col gap-2.5 cursor-pointer active:scale-[0.98]"
          >
            {/* Gradient top bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${service.gradient}`} />

            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${service.gradient} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform duration-300`}>
              {service.icon}
            </div>

            <div className="flex-1">
              <h3 className="text-[13px] font-bold text-[#0f172a] leading-tight group-hover:text-[#4f46e5] transition-colors">
                {service.title}
              </h3>
              <p className="text-[10px] text-[#64748b] mt-0.5 leading-snug line-clamp-1">
                {service.description}
              </p>
            </div>

            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569] group-hover:bg-[#ede9fe] group-hover:text-[#4f46e5] transition-colors">
                {service.count}
              </span>
              <span className="w-5 h-5 rounded-full bg-[#f8fafc] group-hover:bg-[#4f46e5] flex items-center justify-center transition-colors">
                <span className="text-[12px] text-[#94a3b8] group-hover:text-white transition-colors">→</span>
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-xl bg-[#f8fafc] border border-dashed border-[#cbd5e1] flex items-center justify-center gap-2 text-[11px] text-[#64748b]">
        <Sparkles className="w-3.5 h-3.5 text-[#7c3aed]" />
        <span>Tap any service to filter jobs instantly — auto role detection still active</span>
      </div>
    </div>
  );
};

export default ServicesGrid;
