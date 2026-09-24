import { useParams } from 'react-router-dom';
import { useMoonReadStore } from '@/features/moonread/useMoonReadStore';
import { MoonReadReaderPage } from './MoonReadReaderPage';
import { ComicReaderPage } from './ComicReaderPage';
export function ReadingEnginePage(){const {bookId}=useParams();const kind=useMoonReadStore(s=>s.books.find(book=>book.id===bookId)?.documentKind);return kind==='comic'?<ComicReaderPage/>:<MoonReadReaderPage/>;}
